/**
 * Démarrage de la télémétrie du navigateur.
 *
 * ⚠️  C'EST LE FICHIER VOLATIL. Il est le seul à importer le SDK
 *     OpenTelemetry, l'exportateur et l'instrumentation. Le jour où ces
 *     paquets changent c'est le seul fichier à reprendre.
 *
 *   · la documentation d'OpenTelemetry dit :
 *     « Client instrumentation for the browser is experimental and mostly
 *     unspecified. » ;
 *
 *   · DEUX paquets offrent aujourd'hui l'instrumentation de `fetch` au
 *     navigateur : `@opentelemetry/instrumentation-fetch` (0.223.0) et
 *     `@opentelemetry/browser-instrumentation` (0.8.1, sous-chemin
 *     `./experimental/fetch`). Les deux se déclarent EXPÉRIMENTAUX, et
 *     AUCUN DES DEUX N'EST DÉPRÉCIÉ.
 *
 *   · on retient `browser-instrumentation` : c'est le paquet « parapluie »
 *     le plus récent, qui réunit sous un même toit fetch, XHR, erreurs,
 *     navigation et Web Vitals.
 *
 * Ce qu'on fait et ce qu'on ne fait pas :
 *   · TRACES    — oui. C'est le signal mûr au navigateur.
 *                 Il porte la propagation de contexte vers le service dorsal.
 *   · JOURNAUX  — non. Les journaux OpenTelemetry côté JavaScript sont
 *                 encore en développement.
 *                 Le navigateur journalise dans la console, avec
 *                 l'identifiant de trace ajouté à la main.
 *   · MÉTRIQUES — non. Elles n'apportent rien à la démonstration ici.
 */
import { inject, Injectable } from '@angular/core';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';

import { CONFIGURATION } from '../configuration';

@Injectable({ providedIn: 'root' })
export class TelemetryBootstrap {
  private readonly configuration = inject(CONFIGURATION);
  private demarre = false;

  /**
   * Installe le fournisseur de traces et l'instrumentation de `fetch`.
   *
   * <p>Appelé par `provideAppInitializer`, donc AVANT que l'application ne
   * s'affiche et avant sa première requête HTTP.
   * une instrumentation posée après le premier `fetch` ne le voit pas.</p>
   */
  demarrer(): void {
    if (this.demarre) {
      return;
    }
    this.demarre = true;

    const fournisseur = new WebTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.configuration.nomService,
        [ATTR_SERVICE_VERSION]: this.configuration.versionService,
      }),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({ url: this.configuration.urlCollecteurOtlp }),
          { scheduledDelayMillis: 500 },
        ),
      ],
    });

    fournisseur.register();

    //  L'exportateur OTLP envoie ses lots par `fetch`.
    //  Comme `fetch` est précisément ce qu'on instrumente,
    //  chaque envoi produisait un span, qui déclenchait un envoi,
    //  qui produisait un span : une boucle,
    //  et une dizaine de traces parasites « POST » dans Jaeger à chaque clic.
    //  On exclut donc l'adresse du Collector de l'instrumentation.
    const ignorerLeCollecteur = [
      new RegExp('^' + this.configuration.urlCollecteurOtlp),
    ];

    registerInstrumentations({
      tracerProvider: fournisseur,
      instrumentations: [
        new FetchInstrumentation(
          this.configuration.propagationCassee
            ? { ignoreUrls: ignorerLeCollecteur }
            : {
                ignoreUrls: ignorerLeCollecteur,
                //  Sans cette liste, l'instrumentation n'ajoute PAS l'en-tête
                //  `traceparent` aux requêtes d'une AUTRE origine, par
                //  prudence, pour ne pas divulguer un identifiant à un tiers.
                //  Le navigateur et le dorsal produisent alors deux traces
                //  indépendantes.
                propagateTraceHeaderCorsUrls: [
                  new RegExp('^' + this.configuration.urlDorsal),
                ],
              },
        ),
      ],
    });

    if (this.configuration.propagationCassee) {
      console.warn(
        '[demonstration] propagation de contexte DESACTIVEE : ' +
          'le navigateur et le service dorsal produiront deux traces distinctes.',
      );
    }
  }
}