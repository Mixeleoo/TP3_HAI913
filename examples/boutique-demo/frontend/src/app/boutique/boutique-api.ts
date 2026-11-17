/**
 * Accès au service dorsal.
 *
 * <p>Pas d'état, pas de message destiné à l'utilisateur, pas de journal,
 * pas de span.
 * Cette couche connaît des routes et des types ; elle ne sait
 * pas pourquoi on l'appelle.</p>
 *
 * <p>C'est le mirroir du contrôleur du service dorsal,
 * qui ne journalise rien et ne crée aucun span.
 * Ce qui est déjà décrit par l'instrumentation automatique n'a pas à être redit à la main.</p>
 * 
 * <p>Ce fichier n'importe rien d'OpenTelemetry.</p>
 *
 * <h2>Où est l'instrumentation, alors ?</h2>
 *
 * <p>Nulle part dans ce fichier.
 * `HttpClient` est configuré avec `withFetch()` dans `app.config.ts` ;
 * son transport est donc `fetch`. Le span client et l'en-tête `traceparent`
 * apparaissent sans qu'une seule ligne ici ne les demande.</p>
 *
 * <p>Le jour où quelqu'un retire `withFetch()`, ce fichier continuera de
 * fonctionner parfaitement, mais la trace de bout en bout disparaîtra silencieusement.</p>
 */
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CONFIGURATION } from '../core/configuration';
import { Commande, DemandeCommande, Produit, Stock } from './boutique-models';

@Injectable({ providedIn: 'root' })
export class BoutiqueApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CONFIGURATION).urlDorsal;

  produits(): Observable<Produit[]> {
    return this.http.get<Produit[]>(`${this.base}/produits`);
  }

  produit(reference: string): Observable<Produit> {
    return this.http.get<Produit>(`${this.base}/produits/${reference}`);
  }

  stock(reference: string): Observable<Stock> {
    return this.http.get<Stock>(`${this.base}/produits/${reference}/stock`);
  }

  commander(reference: string, quantite: number): Observable<Commande> {
    const demande: DemandeCommande = {
      reference,
      quantite,
      courriel: 'lea.martin@etu.umontpellier.fr',
      motDePasse: 'Tr0ub4dor&3',
    };
    return this.http.post<Commande>(`${this.base}/commandes`, demande);
  }

  panne(): Observable<void> {
    return this.http.get<void>(`${this.base}/panne`);
  }
}