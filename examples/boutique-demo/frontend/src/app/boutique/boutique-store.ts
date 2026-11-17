/**
 * L'état de la boutique et ses cinq cas d'usage.
 *
 * <p>C'est la couche APPLICATION du navigateur.
 * Elle sait ce que l'utilisateur veut faire,
 * orchestre l'appel au service dorsal,
 * et traduit le résultat en état affichable.
 * Elle ne connaît ni le DOM ni OpenTelemetry.</p>
 *
 * <p>Trois responsabilités y sont réunies,
 * parce qu'elles décrivent le même événement ;
 * les séparer obligerait à le nommer trois fois :</p>
 *
 * <ul>
 *   <li><b>le span métier</b> — « l'utilisateur a demandé le stock » ;</li>
 *   <li><b>le journal métier</b> — « le stock est bas » ;</li>
 *   <li><b>l'état affichable</b> — succès ou échec.</li>
 * </ul>
 *
 * <p>C'est le même choix que côté dorsal, où `ServiceBoutique` porte le
 * span manuel ET la ligne de journal métier, pendant que le contrôleur et
 * le dépôt n'en portent aucun.</p>
 *
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { BrowserLogger } from '../core/observability/browser-logger';
import { Observability } from '../core/observability/observability';
import { BoutiqueApi } from './boutique-api';
import { Echec, echecDepuis } from './boutique-errors';
import { Produit } from './boutique-models';

export type Resultat =
  | { readonly etat: 'vide' }
  | { readonly etat: 'succes'; readonly message: string }
  | { readonly etat: 'echec'; readonly echec: Echec };

@Injectable({ providedIn: 'root' })
export class BoutiqueStore {
  private readonly api = inject(BoutiqueApi);
  private readonly observability = inject(Observability);
  private readonly journal = inject(BrowserLogger);

  private readonly _produits = signal<readonly Produit[]>([]);
  private readonly _resultat = signal<Resultat>({ etat: 'vide' });
  private readonly _trace = signal('');
  private readonly _enCours = signal(false);

  readonly produits = this._produits.asReadonly();
  readonly resultat = this._resultat.asReadonly();
  readonly trace = this._trace.asReadonly();
  readonly enCours = this._enCours.asReadonly();

  readonly catalogueCharge = computed(() => this._produits().length > 0);

  // Les cinq gestes

  listerProduits(): Promise<void> {
    return this.geste('action.lister_produits', async (traceId) => {
      const produits = await this.appeler(this.api.produits());
      this._produits.set(produits);
      this.journal.info('catalogue affiche', {
        'produits.nombre': produits.length,
        trace_id: traceId,
      });
      return `${produits.length} produits au catalogue`;
    });
  }

  voirProduit(reference: string): Promise<void> {
    return this.geste('action.voir_produit', async () => {
      const p = await this.appeler(this.api.produit(reference));
      return `${p.libelle} — ${p.prix} €`;
    });
  }

  voirStock(reference: string): Promise<void> {
    return this.geste('action.voir_stock', async (traceId) => {
      const s = await this.appeler(this.api.stock(reference));
      if (s.restant < 5) {
        this.journal.warn('stock bas', {
          'produit.reference': reference,
          restant: s.restant,
          trace_id: traceId,
        });
      }
      return `stock de ${reference} : ${s.restant}`;
    });
  }

  commander(reference: string): Promise<void> {
    return this.geste('action.commander', async (traceId) => {
      const c = await this.appeler(this.api.commander(reference, 2));
      this.journal.info('commande confirmee', {
        'commande.reference_produit': c.reference,
        'commande.montant_eur': c.montant,
        trace_id: traceId,
      });
      return `commande de ${c.quantite} × ${c.reference} — ${c.montant} €`;
    });
  }

  provoquerPanne(): Promise<void> {
    return this.geste('action.provoquer_panne', async () => {
      await this.appeler(this.api.panne());
      //  Si l'on arrive ici, la panne n'a pas eu lieu (ce qui est inattendu).
      return 'inattendu : le service n\'a pas échoué';
    });
  }

  // l'enveloppe

  /**
   * Un geste de l'utilisateur : un span, un état, un échec traduit.
   *
   * <p>Le span manuel est créé ici, à la frontière du cas d'usage.
   * Ni dans le composant (qui ne fait qu'afficher),
   * ni dans l'accès au service dorsal
   * (où il ferait double emploi avec le span automatique du `fetch`).</p>
   */
  private async geste(
    nom: string,
    travail: (traceId: string) => Promise<string>,
  ): Promise<void> {
    this._enCours.set(true);
    this._resultat.set({ etat: 'vide' });
    await this.observability.avecSpan(nom, async (traceId) => {
      try {
        this._resultat.set({ etat: 'succes', message: await travail(traceId) });
      } catch (cause) {
        const echec = echecDepuis(cause);
        this.journal.error('action en echec', {
          action: nom,
          categorie: echec.categorie,
          erreur: echec.message,
          trace_id: traceId,
        });
        this._resultat.set({ etat: 'echec', echec });
      } finally {
        //  C'est cet identifiant qu'on retrouve dans Jaeger,
        //  et qui relie ce clic à la requête SQL du service dorsal.
        this._trace.set(traceId);
        this._enCours.set(false);
      }
    });
  }

  /**
   * Souscrit à l'observable.
   *
   * <p>`firstValueFrom` souscrit de façon synchrone.
   * La requête `fetch` part donc dans la portion synchrone de {@link Observability.avecSpan},
   * pendant que le span du geste est encore le span actif.
   * Le span automatique du `fetch` devient alors son enfant,
   * et l'en-tête `traceparent` porte le bon parent jusqu'au service dorsal.</p>
   *
   * <p>Différer cette souscription
   * (derrière un `await`, un `setTimeout` ou un `queueMicrotask`)
   * casserait silencieusement le rattachement vu que le
   * StackContextManager du navigateur aurait déjà dépilé le contexte.
   * La trace ne serait pas vide, elle serait fausse, ce qui est pire.</p>
   */
  private appeler<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source);
  }
}
