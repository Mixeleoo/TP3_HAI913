/**
 * Les fournisseurs de l'application.
 *
 * <ol>
 *   <li><b>la configuration</b> est un jeton, pas une constante éparpillée
 *       dans le code des fonctionnalités ;</li>
 *   <li><b>HttpClient</b> est fourni sans option de transport : il emploie
 *       `fetch` par DÉFAUT dans la version actuelle d'Angular ;</li>
 *   <li><b>la télémétrie démarre avant l'application</b>, par un
 *       initialiseur.</li>
 * </ol>
 */
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { CONFIGURATION, configurationParDefaut } from './core/configuration';
import { TelemetryBootstrap } from './core/observability/telemetry-bootstrap';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    { provide: CONFIGURATION, useFactory: () => configurationParDefaut() },

    //  ⚠️  Sans `withFetch()` toute la démonstration de traçage navigateur
    //  tombe, silencieusement.
    //
    //  La documentation d'angular.dev décrit aujourd'hui la version 22, où
    //  `fetch` est le transport par défaut.
    provideHttpClient(withFetch()),

    //  `provideAppInitializer` s'exécute avant le premier rendu, donc avant
    //  la première requête HTTP de l'application.
    provideAppInitializer(() => inject(TelemetryBootstrap).demarrer()),
  ],
};