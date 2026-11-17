/**
 * L'identifiant de la trace du dernier geste.
 *
 * <p>Cette poignée de caractères est le lien entre un clic et une requête SQL.
 * C'est le seul endroit de l'interface qui parle d'observabilité, et
 * il le fait sans rien savoir d'OpenTelemetry : on lui passe une chaîne.</p>
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-trace-panel',
  templateUrl: './trace-panel.html',
  styleUrl: './trace-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TracePanel {
  readonly traceId = input.required<string>();
}
