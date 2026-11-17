/**
 * La coquille de l'application.
 *
 * <p>Elle pose le titre et accueille la fonctionnalité.</p>
 *
 * <p>Pas de routeur : il n'y a qu'une page.</p>
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { BoutiquePage } from './boutique/boutique-page';

@Component({
  selector: 'app-root',
  imports: [BoutiquePage],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
