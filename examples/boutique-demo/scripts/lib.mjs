/**
 * Fonctions communes aux scripts de la démonstration.
 *
 * <p>UNE seule implémentation, en Node. Node est déjà requis par l'interface
 * Angular : l'exiger pour l'outillage n'ajoute aucune dépendance. Les
 * scripts tournent donc tels quels sous Windows, macOS et Linux, sans
 * PowerShell, sans Bash et sans WSL.</p>
 *
 * <p>On n'emploie que des modules de la bibliothèque standard — `fs`,
 * `path`, `child_process`, `net`, `os`, et le `fetch` intégré. Pas de
 * cadriciel : un outillage pédagogique qu'on ne peut pas lire n'enseigne
 * rien.</p>
 *
 * <p>RÈGLE DE PORTABILITÉ LA PLUS IMPORTANTE : on lance les processus avec
 * un TABLEAU d'arguments, jamais avec une ligne de commande assemblée à la
 * main. C'est ce qui rend les chemins contenant une espace inoffensifs — le
 * défaut qui cassait la version PowerShell.</p>
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine de la démonstration : le dossier qui contient `scripts/`. */
export const RACINE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export const DORSAL = 'http://127.0.0.1:8080';
export const JAEGER = 'http://localhost:16686';
export const PORT_DORSAL = 8080;

export const JAR = path.join(RACINE, 'backend', 'target', 'boutique-backend.jar');
export const AGENT = path.join(RACINE, 'opentelemetry-javaagent.jar');
export const CAPTURES = path.join(RACINE, 'captures');

/**
 * Le secret envoyé VOLONTAIREMENT par la démonstration.
 *
 * <p>Il est défini ici, à un seul endroit, parce que deux scripts en
 * dépendent : celui qui l'envoie et celui qui vérifie qu'il ne ressort
 * nulle part. Les laisser diverger rendrait la vérification vide de sens.</p>
 */
export const SECRET = 'Tr0ub4dor&3';
export const ADRESSE = 'lea.martin@etu.umontpellier.fr';
export const DOMAINE = 'etu.umontpellier.fr';

export const existe = async (p) =>
  fs.access(p).then(() => true, () => false);

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Teste si quelque chose écoute sur un port local. */
export function portOccupe(port = PORT_DORSAL) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: '127.0.0.1', port });
    const fin = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(700);
    s.once('connect', () => fin(true));
    s.once('timeout', () => fin(false));
    s.once('error', () => fin(false));
  });
}

/**
 * Attend que le port du dorsal soit réellement LIBRE.
 *
 * <p>Sans cette attente, la sonde de démarrage peut répondre « prêt » alors
 * qu'elle parle à une JVM d'un essai précédent : les requêtes partent au
 * mauvais processus, la capture mélange deux sorties, et les spans
 * paraissent avoir disparu. Le symptôme est déroutant, la cause est
 * banale.</p>
 */
export async function attendrePortLibre(secondes = 30) {
  for (let i = 0; i < secondes * 2; i += 1) {
    if (!(await portOccupe())) return true;
    await dormir(500);
  }
  return false;
}

/**
 * Construit la ligne de commande de la JVM et l'environnement associé.
 *
 * <p>Le JAR est le MÊME dans tous les cas : pas une ligne de code ne change
 * entre « sans agent » et « avec agent ». C'est tout l'argument de
 * l'instrumentation zéro-code, et il ne tient que si rien d'autre ne
 * change.</p>
 */
export async function argumentsJvm({ agent = false, console_ = false, json = false } = {}) {
  if (!(await existe(JAR))) {
    throw new Error(
      'jar absent — construisez le dorsal :\n' +
        '    mvn -f backend/pom.xml clean package',
    );
  }

  //  UTF-8 de bout en bout : sans ces propriétés la JVM écrit en Cp1252
  //  sous Windows, et « dépôt » perd ses accents.
  const argv = [
    '-Dfile.encoding=UTF-8',
    '-Dsun.stdout.encoding=UTF-8',
    '-Dsun.stderr.encoding=UTF-8',
  ];
  const env = { ...process.env };

  if (agent) {
    if (!(await existe(AGENT))) {
      throw new Error(
        'agent absent — téléchargez-le :\n' +
          '    node scripts/download-agent.mjs',
      );
    }
    //  Pas de guillemets : l'argument part tel quel dans le tableau remis à
    //  `spawn`. Un chemin contenant une espace ne pose donc aucun problème.
    argv.push(`-javaagent:${AGENT}`);
    env.OTEL_SERVICE_NAME = 'boutique-backend';
    env.OTEL_METRICS_EXPORTER = 'none';
    env.OTEL_LOGS_EXPORTER = 'none';
    env.OTEL_BSP_SCHEDULE_DELAY = '200';
    if (console_) {
      //  Aucune dépendance réseau : utile quand Docker est indisponible.
      env.OTEL_TRACES_EXPORTER = 'console';
      delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
    } else {
      //  Vers le COLLECTOR, jamais directement vers Jaeger.
      env.OTEL_TRACES_EXPORTER = 'otlp';
      env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';
      env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
    }
  } else {
    delete env.OTEL_TRACES_EXPORTER;
    delete env.OTEL_SERVICE_NAME;
  }

  argv.push('-jar', JAR);
  if (json) argv.push('--logging.structured.format.console=ecs');
  return { argv, env };
}

/**
 * Démarre le dorsal en arrière-plan, capture ses deux sorties, et attend
 * qu'il écoute.
 */
export async function demarrerDorsal({ argv, env }, fichierSortie) {
  if (!(await attendrePortLibre())) {
    throw new Error(
      `le port ${PORT_DORSAL} est toujours occupé : arrêtez le processus qui l'utilise`,
    );
  }

  const out = createWriteStream(fichierSortie);
  const err = createWriteStream(`${fichierSortie}.err`);
  await Promise.all([
    new Promise((r) => out.once('open', r)),
    new Promise((r) => err.once('open', r)),
  ]);

  const p = spawn('java', argv, { env, stdio: ['ignore', out, err] });
  p.once('error', (e) => {
    throw new Error(`java introuvable ou illisible : ${e.message}`);
  });

  //  Sonde de démarrage : on teste le PORT, pas une route. Interroger
  //  /produits pour savoir si le service est prêt ajouterait ses propres
  //  lignes de journal à la capture, et les scénarios ne seraient plus
  //  comparables entre eux.
  for (let i = 0; i < 120; i += 1) {
    await dormir(500);
    if (await portOccupe()) {
      await dormir(600);
      return p;
    }
  }
  p.kill();
  throw new Error("le service dorsal n'a pas démarré");
}

export async function arreterDorsal(p) {
  if (p && !p.killed) {
    p.kill();
    //  On attend la fin RÉELLE : tant que le processus vit, il tient le
    //  port et le fichier de sortie.
    await Promise.race([
      new Promise((r) => p.once('exit', r)),
      dormir(15000),
    ]);
  }
  await attendrePortLibre();
  await dormir(400);
}

/**
 * Réunit sortie standard et sortie d'erreur en une seule capture.
 *
 * <p>L'agent écrit ses diagnostics et ses spans sur la sortie d'ERREUR,
 * pendant que l'application journalise sur la sortie standard. Une capture
 * qui n'en garderait qu'une serait trompeuse.</p>
 */
export async function reunirSorties(brut) {
  const lire = async (p) => (await existe(p)) ? fs.readFile(p, 'utf8') : '';
  const txtOut = await lire(brut);
  const txtErr = await lire(`${brut}.err`);
  const sep = `\n${'='.repeat(78)}\n`;
  let texte = `### SORTIE STANDARD - journal de l'application${sep}${txtOut}`;
  if (txtErr.trim()) {
    texte += `\n\n### SORTIE D'ERREUR - agent OpenTelemetry${sep}${txtErr}`;
  }
  return texte;
}

/** Chemin de capture brute, unique par essai. */
export function captureTemporaire() {
  const t = new Date().toISOString().replace(/[^0-9]/g, '').slice(8, 17);
  return path.join(os.tmpdir(), `boutique-dorsal-${t}.txt`);
}

// ---------------------------------------------------------------- Jaeger

const isoDecale = (minutes) =>
  new Date(Date.now() + minutes * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');

/** Les spans d'un service, lus par l'API v3 de Jaeger. */
export async function spansDe(service, minutes = 15) {
  const url =
    `${JAEGER}/api/v3/traces?query.service_name=${encodeURIComponent(service)}` +
    `&query.num_traces=50` +
    `&query.start_time_min=${isoDecale(-minutes)}` +
    `&query.start_time_max=${isoDecale(5)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Jaeger a répondu ${r.status} pour ${service}`);
  const corps = await r.json();
  const lots = Array.isArray(corps) ? corps : [corps];
  const spans = [];
  for (const lot of lots) {
    for (const rs of lot?.result?.resourceSpans ?? []) {
      const svc = (rs.resource?.attributes ?? []).find(
        (a) => a.key === 'service.name',
      )?.value?.stringValue;
      for (const ss of rs.scopeSpans ?? []) {
        for (const s of ss.spans ?? []) {
          spans.push({
            service: svc,
            trace: s.traceId,
            span: s.spanId,
            parent: s.parentSpanId,
            nom: s.name,
          });
        }
      }
    }
  }
  return spans;
}

export async function servicesJaeger() {
  const r = await fetch(`${JAEGER}/api/v3/services`);
  if (!r.ok) throw new Error(`Jaeger a répondu ${r.status}`);
  return (await r.json()).services ?? [];
}

/** Compte les occurrences littérales d'une chaîne. */
export function compter(texte, aiguille) {
  if (!aiguille) return 0;
  let n = 0;
  let i = texte.indexOf(aiguille);
  while (i !== -1) {
    n += 1;
    i = texte.indexOf(aiguille, i + aiguille.length);
  }
  return n;
}
