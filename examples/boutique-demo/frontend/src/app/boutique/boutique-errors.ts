/**
 * Les échecs.
 *
 * <p>Sans ce fichier, chaque action de la boutique finirait par contenir
 * son propre `if (status === 503)`.</p>
 *
 * <p>On distingue trois catégories que l'on diagnostique différemment.</p>
 */
import { HttpErrorResponse } from '@angular/common/http';

export type CategorieEchec =
  /** Le service dorsal n'a pas répondu : arrêté, injoignable, CORS refusé. */
  | 'injoignable'
  /** Il a répondu, et il a dit non. C'est une réponse, pas une panne du réseau. */
  | 'refus-du-service'
  /** Ni l'un ni l'autre : le défaut est de notre côté. */
  | 'inattendu';

export interface Echec {
  readonly categorie: CategorieEchec;
  readonly message: string;
  /** Présent seulement quand le service dorsal a répondu. */
  readonly statut?: number;
}

/**
 * Le service dorsal répond ses erreurs en `ProblemDetail` (RFC 9457).
 * On lit `detail` (la phrase écrite pour un humain) quand il est là.
 */
interface ProblemDetail {
  detail?: string;
  title?: string;
}

export function echecDepuis(cause: unknown): Echec {
  if (cause instanceof HttpErrorResponse) {
    //  Le statut 0 indique ici que la réponse n'est jamais arrivée jusqu'à nous :
    //  service arrêté, réseau coupé, ou contrôle préalable CORS refusé.
    //  Les confondre avec une erreur applicative rend le diagnostic non fiable.
    if (cause.status === 0) {
      return {
        categorie: 'injoignable',
        message:
          'service dorsal injoignable — vérifiez qu\'il écoute sur le port 8080',
      };
    }
    const corps = cause.error as ProblemDetail | string | null;
    const detail =
      typeof corps === 'object' && corps !== null
        ? (corps.detail ?? corps.title)
        : undefined;
    return {
      categorie: 'refus-du-service',
      message: detail ?? `le service a répondu ${cause.status}`,
      statut: cause.status,
    };
  }
  return {
    categorie: 'inattendu',
    message: cause instanceof Error ? cause.message : String(cause),
  };
}