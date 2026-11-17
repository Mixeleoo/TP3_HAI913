/**
 * La page de la boutique (un conteneur).
 *
 * <p>Elle compose trois composants d'affichage, leur passe l'état du
 * magasin et leur renvoie les gestes.
 * Elle ne contient aucune règle, aucun appel réseau, aucun journal, aucun span.</p>
 *
 * <p>C'est la seule classe de l'interface qui connaisse {@link BoutiqueStore} ;
 * ses enfants ne reçoivent que des valeurs.
 * Ils sont donc testables et réutilisables sans rien démarrer.</p>
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { BoutiqueActions } from './boutique-actions';
import { BoutiqueStore } from './boutique-store';
import { ProductList } from './product-list';
import { TracePanel } from './trace-panel';

@Component({
  selector: 'app-boutique-page',
  imports: [BoutiqueActions, ProductList, TracePanel],
  templateUrl: './boutique-page.html',
  styleUrl: './boutique-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoutiquePage {
  protected readonly store = inject(BoutiqueStore);
}
