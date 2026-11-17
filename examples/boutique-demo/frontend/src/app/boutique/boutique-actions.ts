/**
 * Les cinq gestes en cinq boutons
 *
 * <p>Ce composant ne sait pas ce qu'une commande veut dire, ne connaît ni
 * le service dorsal ni OpenTelemetry.
 * Il signale qu'on a cliqué.
 * C'est tout ce qu'un composant de présentation doit faire.</p>
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-boutique-actions',
  templateUrl: './boutique-actions.html',
  styleUrl: './boutique-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoutiqueActions {
  readonly enCours = input.required<boolean>();

  readonly lister = output<void>();
  readonly voirProduit = output<string>();
  readonly voirStock = output<string>();
  readonly commander = output<string>();
  readonly provoquerPanne = output<void>();
}
