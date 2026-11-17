/**
 * Configuration de l'application : un seul endroit pour les constantes
 * d'infrastructure.
 *
 * <p>Aucune URL, aucune identité de service, aucun interrupteur de
 * démonstration ne doit être écrit en dur dans le code d'une fonctionnalité.
 * Parce qu'au moment où l'on se demande « où part la télémétrie ? »,
 * on veut un seul fichier à ouvrir.</p>
 *
 * <p>Le mécanisme est celui que recommande Angular aujourd'hui : un
 * `InjectionToken` fourni par l'application.
 * Pas de fichier d'environnement, pas de cadre de configuration.</p>
 */
import { InjectionToken } from '@angular/core';

export interface ConfigurationApplication {
  /** Origine du service dorsal. Sert aussi à AUTORISER la propagation. */
  readonly urlDorsal: string;

  /** Où part la télémétrie du navigateur : le Collector. */
  readonly urlCollecteurOtlp: string;

  /** Identité de ce service dans la trace. Doit différer du dorsal. */
  readonly nomService: string;

  readonly versionService: string;

  /**
   * Interrupteur pédagogique : casser volontairement la propagation.
   *
   * <p>Activé par `?propagation=cassee`.
   * Il ne coupe PAS la télémétrie,
   * mais retire seulement l'autorisation d'envoyer l'en-tête `traceparent`
   * vers une autre origine, ce que le navigateur ne fait jamais de lui-même.</p>
   */
  readonly propagationCassee: boolean;
}

export const CONFIGURATION = new InjectionToken<ConfigurationApplication>(
  'configuration de l application',
);

export function configurationParDefaut(
  recherche: string = window.location.search,
): ConfigurationApplication {
  return {
    urlDorsal: 'http://localhost:8080',
    urlCollecteurOtlp: 'http://localhost:4318/v1/traces',
    nomService: 'boutique-frontend',
    versionService: '1.0.0',
    propagationCassee:
      new URLSearchParams(recherche).get('propagation') === 'cassee',
  };
}
