# Démonstration d'observabilité — HAI913I, CM 04

Une petite application web complète (**navigateur + service dorsal + base de données**) instrumentée de bout en bout, pour rendre visibles les notions du CM 04 : journalisation, journal structuré, vie privée, instrumentation automatique et manuelle, propagation de contexte, Collector, corrélation.

---

## 1. Ce que cette démonstration veut vous faire voir

| Observation                                                          | Ce que cela démontre                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| La même ligne de journal, avec puis sans identifiants de corrélation | l'instrumentation zéro-code n'exige **aucune** modification du code |
| Une seule trace qui part d'un clic et finit sur un `SELECT`          | la propagation de contexte traverse réellement les processus        |
| Un span `SELECT` que personne n'a écrit                              | l'agent instrumente des bibliothèques que vous n'avez pas écrites   |
| Un span `boutique.commande_validee` qui n'existerait pas sans vous   | aucun agent ne devine le métier                                     |
| Un span lent qui occupe à lui seul presque toute la requête          | la trace répond à « où est passé le temps », le journal non         |
| Un même évènement structuré et un équivalent libre                   | un journal structuré devient interrogeable                          |
| Un mot de passe envoyé, et absent de toute sortie                    | la minimisation se **vérifie**, elle ne se suppose pas              |
| En mode dégradé : deux traces au lieu d'une                          | ce qui arrive quand la propagation casse                            |

---

## 2. Architecture

```
  NAVIGATEUR (Angular, :4200)
      │
      │   boutique-page        composant conteneur : affiche, délègue
      │        │
      │   boutique-store       cas d'usage + état
      │        │   span « action.commander »     <- instrumentation MANUELLE
      │        │
      │   boutique-api         HttpClient typé (n'importe RIEN d'OpenTelemetry)
      │        │
      │   HttpClient + withFetch()
      │        │
      │   fetch INSTRUMENTÉ
      │            span « POST »               <- ZÉRO-CODE (fetch)
      │
      │  en-tête  traceparent: 00-<trace>-<span>-01     [W3C Trace Context]
      v
  SERVICE DORSAL (Spring Boot, :8080)
      │  span « POST /commandes »           <- ZÉRO-CODE (agent Java / Tomcat)
      │  span « boutique.commande_validee » <- MANUELLE (couche service)
      │  span « ProduitJpa.findById »       <- ZÉRO-CODE (Spring Data)
      │  span « SELECT boutique.produit »   <- ZÉRO-CODE (pilote JDBC)
      v
          OTLP        (gRPC depuis le dorsal, HTTP depuis le navigateur)
      v
  OpenTelemetry COLLECTOR (:4317 gRPC, :4318 HTTP + CORS)
      │  réception · mise en lot · export
      v
  JAEGER (:16686)   — stockage, recherche, visualisation
```

Les deux moitiés suivent la **même règle** : ce qui est déjà décrit par l'instrumentation automatique n'est pas redit à la main, et le span métier naît à la frontière du cas d'usage (`boutique-store` au navigateur, `ServiceBoutique` au dorsal).

Le Collector n'est pas obligatoire pour faire de l'OpenTelemetry.
Il l'est **ici** vu que le navigateur émet lui aussi de la télémétrie, donc il faut un point d'entrée OTLP capable de répondre à une requête de contrôle préalable CORS.

---

## 3. Arborescence

```
backend/            service dorsal Spring Boot
  src/main/java/fr/umontpellier/hai913i/boutique/
    api/            le bord HTTP : contrôleur, vues, traduction des erreurs
    service/        les règles du métier
    depot/          la frontière de persistance (interface + réalisation JPA)
    domaine/        les types du métier, sans aucune annotation
    configuration/  amorçage, CORS, tracer
frontend/           interface Angular, organisée PAR FONCTIONNALITÉ
  src/app/
    app.ts                        la coquille : un titre, une page
    app.config.ts                 fournisseurs (dont withFetch())
    core/
      configuration.ts            URL, identité, interrupteur de démo
      observability/
        observability.ts          ce que l'application demande
        browser-logger.ts         journal structuré, corrélé
        telemetry-bootstrap.ts    LE SEUL fichier volatil (SDK OpenTelemetry)
    boutique/
      boutique-page.*             conteneur : compose et délègue
      boutique-actions.*          cinq boutons
      product-list.*              le catalogue
      trace-panel.*               l'identifiant de trace
      boutique-store.ts           état + cas d'usage + SPAN MANUEL
      boutique-api.ts             HttpClient (rien d'OpenTelemetry)
      boutique-models.ts          les types
      boutique-errors.ts          trois catégories d'échec
      *.spec.ts                   20 tests, à côté du code testé
observability/
  otel-collector-config.yaml      Fichier de configuration du collecteur OpenTelemetry
  docker-compose.yml              Docker Compose : lancer une application conteneurisée (le collecteur et le backend d'observabilité (Jaeger))
scripts/            outillage, en Node
  lib.mjs                       le code commun : chemins, JVM, Jaeger
  download-agent.mjs            récupère l'agent Java (26 Mo)
  start-backend.mjs             lance le dorsal, avec ou sans agent
  backend-scenarios.mjs         les six requêtes
  capture-all.mjs               produit ET vérifie les quatre captures
  verify-propagation.mjs        prouve la propagation, des deux côtés
  verify-privacy.mjs            prouve qu'aucun secret ne sort
  *.sh                          enveloppes facultatives (macOS, Linux)
captures/           sorties et copies d'écran de référence
package.json        les commandes de la démonstration (aucune dépendance)
```

---

## 4. Architecture du dorsal
L'architecture est découpée en quatre couches.
Pour chacune on pose la question : **que doit-elle journaliser, et que doit-elle instrumenter ?**

| Couche    | Responsabilité                                     | Journalise                                  | Instrumente à la main    |
| --------- | -------------------------------------------------- | ------------------------------------------- | ------------------------ |
| `api`     | HTTP : lire une demande, rendre une représentation | **rien**                                    | rien                     |
| `service` | décisions et jalons du métier                      | les jalons métier, les conditions dégradées | **oui** (le span métier) |
| `depot`   | accès au stockage                                  | les faits de stockage                       | rien                     |
| `domaine` | les types du métier                                | rien                                        | rien                     |

**Pourquoi la couche API ne journalise rien.**
Le fait « une requête `POST /commandes` a reçu 201 » est déjà porté par le span que l'agent produit, avec sa route, son code et sa durée.
Le réécrire dans un journal, c'est payer deux fois la même information et la désynchroniser à la première divergence.
**Ne dupliquez pas un fait à chaque couche.**

**Pourquoi le span métier est dans le service.**
Parce que c'est là que la décision est prise.
Le mettre dans le contrôleur le rendrait dépendant du protocole.
Si demain la commande arrive par une file de messages, le jalon métier doit survivre.

---

## 5. Architecture du frontal

Le frontal répond à la même exigence que le dorsal : **les responsabilités sont séparées, et l'observabilité les traverse sans les confondre**.

Il est organisé **par fonctionnalité**.
C'est ce que recommande le guide de style d'Angular, qui nomme explicitement `components/`, `directives/` et `services/` comme regroupements à éviter.

### 5.1 Les quatre couches

| Couche              | Fichiers                                                                   | Ce qu'elle sait                                                   | Ce qu'elle ignore                    |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| **coquille**        | `app.ts`                                                                   | poser le titre, accueillir la page                                | tout le reste                        |
| **présentation**    | `boutique-page.*`, `boutique-actions.*`, `product-list.*`, `trace-panel.*` | afficher, signaler un clic                                        | le réseau, les règles, la télémétrie |
| **application**     | `boutique-store.ts`                                                        | les cinq cas d'usage, l'état, le span de geste, le journal métier | le DOM, OpenTelemetry                |
| **accès au dorsal** | `boutique-api.ts`, `boutique-models.ts`, `boutique-errors.ts`              | des routes et des types                                           | pourquoi on l'appelle                |

Et, transversalement :

| Transversal       | Fichiers                                    | Rôle                                                                 |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| **configuration** | `core/configuration.ts`                     | URL du dorsal, du Collector, identité, interrupteur de démonstration |
| **observabilité** | `core/observability/observability.ts`       | ce que l'application demande : « ce geste mérite un span »           |
|                   | `core/observability/browser-logger.ts`      | journal structuré en console, corrélé                                |
|                   | `core/observability/telemetry-bootstrap.ts` | SDK, exportateur, instrumentation (**le seul fichier volatil**)      |

### 5.2 Le sens des dépendances

```
app  (coquille)
 └─ boutique-page            conteneur : compose et délègue
     ├─ boutique-actions     cinq boutons, aucune règle
     ├─ product-list         un tableau
     ├─ trace-panel          un identifiant de trace
     └─ boutique-store       état + cinq cas d'usage + SPAN MANUEL
         ├─ boutique-api     HttpClient, typé
         │   └─ HttpClient ─ withFetch() ─▶ fetch INSTRUMENTÉ
         │                                     │ traceparent
         │                                     ▼  service dorsal
         ├─ Observability    @opentelemetry/api seulement
         └─ BrowserLogger
```

### 5.3 Où est l'instrumentation
**Le span AUTOMATIQUE** naît sous `HttpClient`.
Personne ne l'écrit.
`app.config.ts` déclare `provideHttpClient(withFetch())` ; le transport est donc `fetch`.
Le span réseau et l'en-tête `traceparent` apparaissent sans qu'une ligne de `boutique-api.ts` ne les demande.

> ⚠️ Sans `withFetch()`, `HttpClient` passe par `XMLHttpRequest` en Angular 21, que cette instrumentation n'observe pas.
> Tout continue de fonctionner et la trace de bout en bout disparaît, silencieusement.

**Le span MANUEL** naît dans `boutique-store.ts`, à la frontière du cas d'usage.
Pas dans un composant, qui ne fait qu'afficher.
Pas dans l'accès au dorsal, où il ferait double emploi avec le span automatique.
Les cinq noms : `action.lister_produits`, `action.voir_produit`, `action.voir_stock`,
`action.commander`, et `action.provoquer_panne` désignent un **geste** et non pas une requête.
C'est ce que l'instrumentation automatique ne peut pas deviner.
C'est la même répartition que côté dorsal, où `ServiceBoutique` porte le seul span manuel et où le contrôleur n'en porte aucun.

### 5.4 Pourquoi une abstraction d'observabilité
`boutique-store.ts` n'appelle pas OpenTelemetry, il appelle `Observability.avecSpan(...)`.

L'instrumentation navigateur est expérimentale (§ 6) et ses paquets bougent.
L'indirection permet à la fonctionnalité d'exprimer son **intention** sans dépendre de la bibliothèque qui l'implémente.

- `observability.ts` n'importe que **`@opentelemetry/api`**, en version **stable 1.x** ;
- `telemetry-bootstrap.ts` importe le SDK, l'exportateur et l'instrumentation (tous expérimentaux).
- **C'est le seul fichier à reprendre** le jour où l'API change.

### 5.5 Le journal du navigateur
`BrowserLogger` est injectable.
Il écrit un objet et y ajoute le `trace_id`.

**On journalise dans la couche application.**
Pas dans les composants : afficher n'est pas un événement.
Ni dans l'accès au dorsal : le span automatique dit déjà tout.
Même discipline que le dorsal, où le contrôleur ne journalise rien.

Le `trace_id` est **passé** par l'appelant.
Un événement métier est presque toujours journalisé APRÈS un `await`, et à cet instant le gestionnaire de contexte du navigateur a déjà perdu le contexte actif.
Côté dorsal, l'agent Java dépose `trace_id` dans le **Mapped Diagnostic Context (MDC)** de SLF4J sans que personne ne l'écrive.

### 5.6 Les échecs
`boutique-errors.ts` traduit trois situations qu'on ne diagnostique pas de la même façon :

| Catégorie          | Ce que c'est                               | Ce qu'on en déduit                          |
| ------------------ | ------------------------------------------ | ------------------------------------------- |
| `injoignable`      | statut 0 : la réponse n'est jamais arrivée | service arrêté, réseau, ou CORS refusé      |
| `refus-du-service` | le dorsal a répondu, et il a dit non       | lire `detail` du `ProblemDetail` (RFC 9457) |
| `inattendu`        | ni l'un ni l'autre                         | le défaut est de notre côté                 |

Attention à ne pas les confondre.

### 5.7 Le démarrage de la télémétrie
`app.config.ts` déclare `provideAppInitializer(() => inject(TelemetryBootstrap).demarrer())`.

L'initialiseur s'exécute **avant le premier rendu**, donc avant la première requête HTTP.
L'instrumentation est en place quand le premier geste part.
`main.ts` reste un point d'entrée de trois lignes.

### 5.8 Les tests
20 tests, lancés par `npm test` (Vitest, par le constructeur `@angular/build:unit-test` de la CLI Angular).

`boutique-store.spec.ts` s'exécute avec un double de `Observability` **de trois lignes**, sans Collector, sans Jaeger, sans réseau.
Si ce test avait besoin de la chaîne d'observabilité complète, c'est que l'abstraction ne servirait à rien.

On ne teste pas le comportement d'OpenTelemetry.
Il est validé par les scripts d'intégration et par la relecture des traces.

---

## 6. Le navigateur est EXPÉRIMENTAL
La documentation officielle d'OpenTelemetry dit, à la date de ce document :

> « Client instrumentation for the browser is **experimental** and mostly
> **unspecified**. »

Ce n'est pas une raison de l'écarter ; c'en est une de la **traiter avec prudence** :

- **deux** paquets offrent aujourd'hui l'instrumentation de `fetch` au navigateur :
  - `@opentelemetry/instrumentation-fetch` et `@opentelemetry/browser-instrumentation`
  - **les deux se déclarent expérimentaux**.
  - La documentation officielle n'en recommande aucun ; on a retenu le second, qui est le plus récent.
- les noms de paquets, les interfaces et les attributs **peuvent changer** d'une version à l'autre ;
- toute cette instabilité est donc enfermée dans **un seul fichier**.

Et en conséquence :

- on utilise OpenTelemetry côté navigateur **pour les traces uniquement** ;
- les **journaux** OpenTelemetry en JavaScript sont encore « en développement ». 
- Le navigateur journalise en console, et c'est `BrowserLogger` qui y ajoute l'identifiant de trace **à la main**.

Côté Java, l'agent dépose `trace_id` tout seul dans le contexte du logger.
Côté navigateur, personne ne le fait pour vous.

---

## 7. Versions

| Composant                                 | Version                                          |
| ----------------------------------------- | ------------------------------------------------ |
| JDK                                       | **17.0.10**                                      |
| Maven                                     | **3.9.6**                                        |
| Spring Boot                               | **4.1.1** (Spring Framework 7.0.9)               |
| SLF4J                                     | **2.0.18** — relevé dans le jar construit        |
| Logback                                   | **1.5.38** — relevé dans le jar construit        |
| Hibernate                                 | **7.4.5**                                        |
| Base                                      | **H2 2.4.240**, en mémoire                       |
| OpenTelemetry API/SDK (Java)              | **1.66.0**                                       |
| Agent Java OpenTelemetry                  | **2.32.0**                                       |
| Node                                      | **22.18.0** · npm **10.9.3**                     |
| Angular                                   | **21.2.25** (CLI 21.2.26) · TypeScript **5.9.3** |
| Vitest                                    | **4.1.11** · jsdom **29.1.1**                    |
| `@opentelemetry/api`                      | **1.9.1** — *stable*                             |
| `@opentelemetry/sdk-trace-web`            | **2.12.0**                                       |
| `@opentelemetry/browser-instrumentation`  | **0.8.1** — expérimental                         |
| `@opentelemetry/exporter-trace-otlp-http` | **0.223.0**                                      |
| OpenTelemetry Collector                   | **0.162.0**                                      |
| Jaeger                                    | **2.22.0**                                       |
| Docker Engine                             | **26.0.0**                                       |

---

## 8. Prérequis
- **JDK 17** et **Maven** sur le `PATH` ;
- **Node.js** et **npm** ;
- **Docker** (uniquement pour le Collector et Jaeger) ;
- les ports **8080**, **4200**, **4317**, **4318** et **16686** libres.

Aucun PowerShell, aucun Bash, aucun WSL : l'outillage est en Node, que
l'interface Angular exige déjà.

### Versions de Node
Il faut distinguer deux choses :

|                                     |                                                |
| ----------------------------------- | ---------------------------------------------- |
| **Pris en charge** par Angular 21.2 | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0`          |
| **Testé** pour cette démonstration  | Node **22.18.0**, npm **10.9.3**, sous Windows |

---

## 9. Mise en route
Toutes les commandes ci-dessous sont conçues pour s'exécuter **telles quelles** sous Windows, macOS et Linux, depuis la racine `boutique-demo/` ; la procédure complète a été éprouvée sous Windows.

### Installation, une fois pour toutes

```
node scripts/download-agent.mjs
mvn -f backend/pom.xml clean package
cd frontend && npm ci && npm test && cd ..
docker compose -f observability/docker-compose.yml up -d
```

L'agent Java pèse 26 Mo et n'est pas livré avec l'archive, il se télécharge.
Relancer le script ne retélécharge rien.

### Démarrage
Trois processus au premier plan, trois fenêtres, et `Ctrl-C` pour arrêter chacun.

```
# terminal 1 — l'infrastructure (déjà lancée ci-dessus)
docker compose -f observability/docker-compose.yml up

# terminal 2 — le service dorsal, AVEC l'agent
node scripts/start-backend.mjs --agent

# terminal 3 — l'interface web
cd frontend && npm start
```

Puis **http://localhost:4200** et **http://localhost:16686**.

### Les mêmes commandes, en plus court

Un `package.json` à la racine les expose, sans ajouter la moindre
dépendance :

```
npm run agent              # télécharge l'agent Java
npm run backend            # dorsal sans agent
npm run backend:agent      # dorsal avec agent
npm run captures           # produit ET vérifie les quatre captures
npm run verify             # propagation + confidentialité
```

### Arrêt

```bash
# Ctrl-C dans le terminal du dorsal, et dans celui de « npm start »
docker compose -f observability/docker-compose.yml down # pour arrêter le collecteur et Jaeger
```

---

## 10. Ports

| Port  | Qui                | Quoi                                  |
| ----- | ------------------ | ------------------------------------- |
| 4200  | frontal Angular    | l'interface                           |
| 8080  | dorsal Spring Boot | l'API REST                            |
| 4317  | Collector          | OTLP/gRPC — le dorsal                 |
| 4318  | Collector          | OTLP/HTTP — le navigateur (avec CORS) |
| 16686 | Jaeger             | l'interface de consultation           |

Les ports OTLP de Jaeger ne sont **pas** publiés parce que rien ne lui parle directement, tout passe par le Collector.

---

## 11. CORS
**1. Le Collector doit accepter le navigateur** (`otel-collector-config.yaml`) :

```yaml
http:
  endpoint: 0.0.0.0:4318
  cors:
    allowed_origins: [ http://localhost:4200 ]
```

Sans cela, le navigateur n'arrive même pas à **envoyer** sa télémétrie.

**2. Le dorsal doit accepter l'en-tête `traceparent`**
(`ConfigurationCors.java`) :

```java
.allowedHeaders("Content-Type", "traceparent", "tracestate", "baggage")
```

Sans cela les requêtes passent, mais **l'en-tête de trace est retiré** et vous obtenez deux traces au lieu d'une.
C'est un piège, et il est silencieux.
On ne met jamais de `*` sur un collecteur.

---

## 12. Scénarios à exécuter
### A. Le contraste : sans agent, puis avec

```
node scripts/backend-scenarios.mjs --out captures/01-sans-agent.txt
node scripts/backend-scenarios.mjs --agent --console --out captures/02-avec-agent.txt
```

**À observer :**

- le JAR est le même.
- Pas une ligne de code ne change.
- Les champs `trace_id` et `span_id` passent de vides à remplis.

### B. Le journal structuré

```
node scripts/backend-scenarios.mjs --agent --console --json --out captures/03-journal-structure.txt
```

Cherchez les deux lignes `commande` : **le même événement**, écrit en phrase puis en champs typés.

### C. Le parcours complet, depuis le navigateur

Ouvrez **http://localhost:4200** et cliquez les cinq actions, dans l'ordre :

1. *Lister les produits*,
2. *Voir P-1002*,
3. *Stock de P-1003 (lent)*,
4. *Commander P-1003*,
5. *Provoquer une panne*.

Ouvrez aussi la console du navigateur.
Chaque ligne de journal est un **objet** et **chacune porte un `trace_id`**.
C'est ce `trace_id` que vous collerez dans Jaeger.

### D. La propagation cassée

Ouvrez **http://localhost:4200/?propagation=cassee** et refaites une action.
Tout fonctionne, les spans arrivent, mais en **deux traces distinctes**.

### E. Tout vérifier

```
node scripts/capture-all.mjs             # produit ET vérifie les 4 captures
node scripts/verify-propagation.mjs      # prouve la propagation, des deux côtés
node scripts/verify-privacy.mjs          # prouve qu'aucun secret ne sort
cd frontend && npm test && cd ..         # 20 tests du frontal
```

Les deux vérificateurs **échouent bruyamment** si les contraintes examinées correspondantes sont violées.

---

## 13. Comment trouver la trace de bout en bout
1. L'interface affiche en bas **l'identifiant de trace** du dernier geste.
2. Dans Jaeger, collez-le dans *Lookup by Trace ID*.
3. Ou : service `boutique-frontend`, opération `action.commander`.

### Reconnaître qui est qui
- **Deux couleurs** dans la cascade : une par service.
- La colonne de gauche nomme le service de chaque span : `boutique-frontend` ou `boutique-backend`.
- L'en-tête de la trace indique **Services 2** : c'est le signe que la propagation a fonctionné.

Une trace de référence est dans `captures/11-trace-bout-en-bout-lente.jpg`.
Son en-tête Jaeger dit tout : **Duration 539 ms · Services 2 · Depth 7 · Total Spans 8**.

Et la contre-épreuve est dans `captures/13-propagation-cassee.jpg`.
Le même geste, en mode dégradé, donne **Services 1 · Depth 2 · Total Spans 2**.
Le navigateur et le dorsal sont toujours instrumentés tous les deux ; ils ne se parlent simplement plus.

---

## 14. Garanties de confidentialité
La requête `POST /commandes` envoie **réellement** un mot de passe et une adresse électronique complète.
Trois lignes de défense, par ordre d'importance :

1. **Le contrôleur ne transmet pas le mot de passe au service.** Ce qui n'est pas transmis ne peut pas fuir.
1. **Le service ne retient que le domaine** de l'adresse : il répond à la question posée sans singulariser personne.
1. **Le type du domaine n'a pas de champ pour cela.** La garantie est structurelle, pas déclarative.

Côté navigateur, la même discipline s'applique par construction.
Le secret n'existe que dans `boutique-api.ts`, au moment de bâtir la requête.
Le type `DemandeCommande` le porte ; ni l'état de la fonctionnalité, ni les composants, ni le journal du navigateur ne le voient jamais passer.

`verify-privacy.mjs` inspecte les journaux **et** les spans stockés par Jaeger, donc tout ce qui a traversé le Collector, y compris le navigateur.
Il a été éprouvé par mutation, c'est-à-dire lorsqu'il est soumis à une capture contenant volontairement le secret, il échoue.

---

## 15. Problèmes courants
### `npm ci` échoue : EBUSY, EPERM, puis une erreur `esbuild` / ENOENT

**C'est presque toujours une affaire de LONGUEUR DE CHEMIN.**

Windows limite un chemin à **260 caractères** tant que l'option système « chemins longs » n'est pas activée.
`node_modules` empile des dossiers profonds : il ajoute facilement 120 caractères à l'emplacement où vous avez décompressé l'archive.

Ce qui se passe alors, dans l'ordre :

1. npm écrit les paquets, puis réorganise l'arbre ;
2. certaines opérations dépassent 260 caractères et échouent, `EPERM` ;
3. l'arbre reste incomplet ;
4. le script d'installation d'esbuild cherche son binaire, ne le trouve pas, et s'arrête sur `ENOENT`.

**Remède : décompressez dans un chemin court (e.g. `C:/hai913i/boutique-demo`) et relancez npm ci.**

### `EBUSY` en plus, sur un dossier synchronisé
Si votre dossier est synchronisé (Google Drive, OneDrive, Dropbox, iCloud, etc.), le client de synchronisation ouvre les fichiers que npm vient d'écrire, pour les téléverser.
npm ne peut alors plus les déplacer : `EBUSY`.
Le plus simple reste de travailler hors du dossier synchronisé.

### `npm ci` ou `npm install` ?

La règle est courte :

|                   |                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **`npm ci`**      | pour installer le projet tel qu'il est livré. C'est la commande de ce README. Elle lit `package-lock.json` et n'invente rien. |
| **`npm install`** | uniquement si vous modifiez délibérément les dépendances. Elle recalcule l'arbre et réécrit le verrou.                        |

### Le premier `npm test` échoue en 60 s, sans exécuter un seul test

Symptôme exact, sur un arbre fraîchement installé :

```
Error: [vitest-pool]: Failed to start forks worker for test files …spec.ts
Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond

 Test Files  no tests
      Tests  no tests
     Errors  3 errors
   Duration  60.09s (transform 0ms, setup 0ms, import 0ms, tests 0ms)
```

**Relancez simplement `npm test`.** Le second lancement prend trois secondes
et passe les 20 tests. Observé une fois sur cinq cycles `npm ci` + `npm test`
complets, et jamais au deuxième lancement.

Ce qui se passe : `ng test` construit d'abord l'application — une vingtaine
de secondes — puis vitest démarre un processus par fichier de test. Sur un
`node_modules` qui vient d'être écrit, et que l'antivirus de Windows est en
train de parcourir, ces processus mettent parfois plus de 60 secondes à
répondre. Ce délai de 60 secondes est une **constante écrite en dur** dans
vitest 4.1.11 (`START_TIMEOUT = 6e4`) : aucune option de configuration ne le
relève. Une fois les fichiers en cache, le problème disparaît.

Rien de tout cela ne touche l'application ni la démonstration.

### Le reste

| Symptôme                                              | Cause probable                                | Remède                                                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tout marche, mais la trace s'arrête au navigateur** | `withFetch()` retiré de `app.config.ts`       | **le piège le plus coûteux.** Sans lui, Angular 21 passe par `XMLHttpRequest`, que l'instrumentation n'observe pas. Rien ne casse : la trace disparaît, c'est tout |
| « le service dorsal n'a pas démarré »                 | port 8080 occupé                              | voir les commandes par système ci-dessous                                                                                                                          |
| `trace_id` vide alors que l'agent tourne              | agent non chargé                              | cherchez `VersionLogger` sur la sortie d'erreur                                                                                                                    |
| Deux traces au lieu d'une                             | `traceparent` non propagé                     | mode `?propagation=cassee` actif, ou `allowedHeaders` du dorsal                                                                                                    |
| Le navigateur n'envoie rien au Collector              | CORS                                          | `allowed_origins` dans `otel-collector-config.yaml`                                                                                                                |
| Rien dans Jaeger                                      | export                                        | `docker compose -f observability/docker-compose.yml logs -f collector`                                                                                             |
| Catalogue vide                                        | amorçage                                      | il s'exécute en `@PostConstruct`, donc avant l'ouverture du port                                                                                                   |
| La première requête est bien plus lente               | chargement de classes, compilation à la volée | ne concluez jamais sur un seul échantillon                                                                                                                         |

### Qui occupe le port 8080 ?

**Windows**

```
netstat -ano | findstr :8080
taskkill /PID <pid> /F
```

**macOS, Linux**

```
lsof -i :8080
kill <pid>
```

---

## 16. Les scripts

| Script                   | Ce qu'il fait                                                      |
| ------------------------ | ------------------------------------------------------------------ |
| `download-agent.mjs`     | récupère l'agent Java depuis Maven Central. Idempotent.            |
| `start-backend.mjs`      | lance le dorsal au premier plan. `--agent`, `--console`, `--json`. |
| `backend-scenarios.mjs`  | joue les six mêmes requêtes et écrit une capture.                  |
| `capture-all.mjs`        | produit les quatre captures **et les vérifie**.                    |
| `verify-propagation.mjs` | deux preuves : en-tête fabriqué, puis une trace à deux services.   |
| `verify-privacy.mjs`     | cherche le secret dans les journaux **et** dans les spans.         |
| `lib.mjs`                | le code commun. Une seule implémentation, lue par tous.            |

Les fichiers `.sh` à côté sont de simples enveloppes de confort pour macOS, Linux et Git Bash.

---

## 17. Ce qui est stable, et ce qui ne l'est pas

| Stable, durera                               | Instable, à revérifier périodiquement                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| le modèle trace/span                         | les paquets OpenTelemetry **navigateur**                                |
| W3C Trace Context (Recommandation)           | les noms d'attributs des conventions sémantiques                        |
| l'agent Java et son instrumentation          | la maturité des journaux JavaScript                                     |
| OTLP, et le rôle du Collector                | la syntaxe de configuration du Collector                                |
| la séparation en couches, des **deux** côtés | les versions de tout ce tableau                                         |
| `@opentelemetry/api` (stable 1.x)            | le transport par défaut de `HttpClient` (changé entre Angular 21 et 22) |