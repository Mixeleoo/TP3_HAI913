/**
 * L'observabilité vue par l'application.
 *
 * <p>C'est la seule porte par laquelle une fonctionnalité parle de
 * télémétrie. Elle offre deux opérations :</p>
 *
 * <ul>
 *   <li>{@link Observability.avecSpan} — « cette opération mérite un span
 *       métier » ;</li>
 *   <li>{@link Observability.traceCourante} — « quel est l'identifiant de
 *       la trace en cours ? », pour le journal du navigateur.</li>
 * </ul>
 *
 * <p>POURQUOI CETTE INDIRECTION. La boutique doit pouvoir exprimer son
 * INTENTION — « ceci est un geste de l'utilisateur » — sans dépendre de la
 * bibliothèque qui l'implémente.
 * L'instrumentation navigateur d'OpenTelemetry est expérimentale, et ses
 * paquets continuent à bouger.</p>
 *
 * <p>CE QUE CE FICHIER IMPORTE. Il n'importe que `@opentelemetry/api`,
 * qui est en version **stable 1.x**.
 * Les paquets volatils (SDK, exportateur, instrumentation) vivent tous dans
 * `telemetry-bootstrap.ts`.
 * La frontière passe donc là où passe l'instabilité.</p>
 */
import { Injectable } from '@angular/core';
import { context, trace } from '@opentelemetry/api';

@Injectable({ providedIn: 'root' })
export class Observability {
  /**
   * Exécute un travail dans un span nommé d'après le GESTE.
   *
   * <p>L'instrumentation automatique sait qu'une requête HTTP a eu lieu ;
   * elle ne sait pas que l'utilisateur a cliqué sur « commander ».
   * C'est ici qu'elle s'écrit.</p>
   *
   * <p>L'identifiant de trace est passé au travail parce qu'il est lu
   * IMMÉDIATEMENT, pendant que le span est actif. Après un `await`, le
   * gestionnaire de contexte par défaut du navigateur (StackContextManager)
   * a perdu le contexte : `context.active()` ne rend plus le span. C'est une
   * limite réelle de la pile navigateur, que `ZoneContextManager`
   * corrigerait.</p>
   *
   * <p>Conséquence pratique : l'appel HTTP doit partir dans la portion SYNCHRONE du travail,
   * sinon le span automatique du `fetch` ne sera pas rattaché à celui-ci.
   * C'est le cas : `BoutiqueApi` souscrit immédiatement.</p>
   */
  async avecSpan<T>(
    nom: string,
    travail: (traceId: string) => Promise<T>,
  ): Promise<T> {
    const tracer = trace.getTracer('boutique');
    const span = tracer.startSpan(nom);
    const traceId = span.spanContext().traceId;
    try {
      return await context.with(trace.setSpan(context.active(), span), () =>
        travail(traceId),
      );
    } catch (e) {
      span.recordException(e as Error);
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Identifiant de la trace ACTIVE, ou chaîne vide hors de tout span.
   *
   * <p>Ne vaut quelque chose que dans un contexte synchrone
   * (voir la remarque ci-dessus.</p>
   */
  traceCourante(): string {
    return trace.getSpan(context.active())?.spanContext().traceId ?? '';
  }
}
