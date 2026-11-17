/**
 * Journal du navigateur.
 *
 * <p>Les journaux OpenTelemetry côté JavaScript sont encore « en
 * développement ».
 * On journalise donc dans la console, mais en STRUCTURÉ et on y
 * ajoute à la main l'identifiant de la trace courante.</p>
 *
 * <p>Avec le service dorsal, l'agent Java dépose `trace_id`
 * dans le MDC de SLF4J sans que personne ne l'écrive.
 * Ici, personne ne le fait pour nous.</p>
 *
 * <p>OÙ L'ON JOURNALISE.
 * Dans la couche application ({@link BoutiqueStore}).
 * Pas dans les composants : afficher n'est pas un événement.
 * Ni dans l'accès au service dorsal, dont le span automatique dit déjà tout.
 * C'est la même discipline que côté dorsal, où le contrôleur ne journalise rien.</p>
 */
import { inject, Injectable } from '@angular/core';

import { Observability } from './observability';

type Niveau = 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class BrowserLogger {
  private readonly observability = inject(Observability);

  info(message: string, champs?: Record<string, unknown>): void {
    this.ecrire('info', message, champs);
  }

  warn(message: string, champs?: Record<string, unknown>): void {
    this.ecrire('warn', message, champs);
  }

  error(message: string, champs?: Record<string, unknown>): void {
    this.ecrire('error', message, champs);
  }

  private ecrire(
    niveau: Niveau,
    message: string,
    champs: Record<string, unknown> = {},
  ): void {
    //  Le `trace_id` vient de l'appelant s'il le connaît, et du contexte
    //  actif sinon.
    //
    //  Un événement métier est presque toujours journalisé APRÈS un `await`
    //  (une fois la réponse reçue)
    //  et à cet instant le StackContextManager a déjà perdu le contexte :
    //  le contexte actif ne rendrait rien.
    //  La couche application tient l'identifiant depuis le début de l'action ;
    //  elle le passe.
    //
    //  C'est le travail que l'agent Java fait tout seul côté dorsal, 
    //  en déposant `trace_id` dans le MDC de SLF4J.
    //  Au navigateur, il faut l'écrire.
    //  Une ligne de journal sans identifiant de trace n'est corrélable à rien.
    const fourni = champs['trace_id'];
    const traceId =
      typeof fourni === 'string' && fourni
        ? fourni
        : this.observability.traceCourante();
    console[niveau](
      JSON.stringify({
        niveau: niveau.toUpperCase(),
        message,
        ...champs,
        trace_id: traceId || undefined,
      }),
    );
  }
}
