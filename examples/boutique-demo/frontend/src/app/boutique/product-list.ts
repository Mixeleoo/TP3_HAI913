/**
 * Le catalogue, en tableau. Composant d'affichage pur.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Produit } from './boutique-models';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  readonly produits = input.required<readonly Produit[]>();
}
