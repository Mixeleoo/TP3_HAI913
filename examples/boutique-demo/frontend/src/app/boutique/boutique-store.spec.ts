/**
 * L'état de la boutique, testé sans Collector, sans Jaeger, sans réseau.
 *
 * <p>Si ce fichier avait besoin d'une chaîne d'observabilité pour tourner, c'est que
 * l'abstraction {@link Observability} ne servirait à rien.
 * Elle est ici remplacée par un double de trois lignes.</p>
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BrowserLogger } from '../core/observability/browser-logger';
import { Observability } from '../core/observability/observability';
import { BoutiqueApi } from './boutique-api';
import { BoutiqueStore } from './boutique-store';

const TRACE = '0af7651916cd43dd8448eb211c80319c';

/** Double de l'observabilité (pas d'OpenTelemetry dans les tests) */
class ObservabiliteDouble {
  readonly spans: string[] = [];
  async avecSpan<T>(nom: string, travail: (t: string) => Promise<T>) {
    this.spans.push(nom);
    return travail(TRACE);
  }
  traceCourante() {
    return TRACE;
  }
}

class JournalDouble {
  readonly lignes: { niveau: string; message: string; champs?: unknown }[] = [];
  info = (m: string, c?: unknown) =>
    this.lignes.push({ niveau: 'info', message: m, champs: c });
  warn = (m: string, c?: unknown) =>
    this.lignes.push({ niveau: 'warn', message: m, champs: c });
  error = (m: string, c?: unknown) =>
    this.lignes.push({ niveau: 'error', message: m, champs: c });
}

function configurer(api: Partial<BoutiqueApi>) {
  const observabilite = new ObservabiliteDouble();
  const journal = new JournalDouble();
  TestBed.configureTestingModule({
    providers: [
      { provide: BoutiqueApi, useValue: api },
      { provide: Observability, useValue: observabilite },
      { provide: BrowserLogger, useValue: journal },
    ],
  });
  return { store: TestBed.inject(BoutiqueStore), observabilite, journal };
}

describe('BoutiqueStore', () => {
  it('part de l etat vide', () => {
    const { store } = configurer({});
    expect(store.resultat().etat).toBe('vide');
    expect(store.produits()).toEqual([]);
    expect(store.trace()).toBe('');
    expect(store.enCours()).toBe(false);
  });

  it('met le catalogue a jour et rend la main', async () => {
    const produits = [{ reference: 'P-1', libelle: 'Un', prix: 10 }];
    const { store, journal } = configurer({ produits: () => of(produits) });

    await store.listerProduits();

    expect(store.produits()).toEqual(produits);
    expect(store.resultat()).toEqual({
      etat: 'succes',
      message: '1 produits au catalogue',
    });
    expect(store.enCours()).toBe(false);
    expect(journal.lignes[0].message).toBe('catalogue affiche');
  });

  it('nomme le span d apres le GESTE, pas d apres la requete', async () => {
    const { store, observabilite } = configurer({
      produits: () => of([]),
      stock: () => of({ reference: 'P-1003', restant: 9 }),
      commander: () => of({ reference: 'P-1003', quantite: 2, montant: 79 }),
    });

    await store.listerProduits();
    await store.voirStock('P-1003');
    await store.commander('P-1003');

    expect(observabilite.spans).toEqual([
      'action.lister_produits',
      'action.voir_stock',
      'action.commander',
    ]);
  });

  it('publie l identifiant de trace du geste', async () => {
    const { store } = configurer({ produits: () => of([]) });
    await store.listerProduits();
    expect(store.trace()).toBe(TRACE);
  });

  it('avertit quand le stock est bas', async () => {
    const { store, journal } = configurer({
      stock: () => of({ reference: 'P', restant: 1 }),
    });
    await store.voirStock('P');
    expect(journal.lignes.some((l) => l.niveau === 'warn')).toBe(true);
  });

  it('ne journalise rien quand le stock est normal', async () => {
    //  Une journalisation qui se déclenche à chaque passage ne dit plus rien.
    // Le dorsal applique la même règle.
    const { store, journal } = configurer({
      stock: () => of({ reference: 'P', restant: 50 }),
    });
    await store.voirStock('P');
    expect(journal.lignes).toEqual([]);
  });

  it('traduit un refus du service en echec lisible', async () => {
    const { store, journal } = configurer({
      panne: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              error: { detail: 'dépôt indisponible' },
            }),
        ),
    });

    await store.provoquerPanne();

    const resultat = store.resultat();
    expect(resultat.etat).toBe('echec');
    if (resultat.etat === 'echec') {
      expect(resultat.echec.categorie).toBe('refus-du-service');
      expect(resultat.echec.message).toBe('dépôt indisponible');
      expect(resultat.echec.statut).toBe(503);
    }
    expect(store.enCours()).toBe(false);
    expect(journal.lignes.at(-1)?.niveau).toBe('error');
  });

  it('distingue un service injoignable d un refus', async () => {
    const { store } = configurer({
      produits: () => throwError(() => new HttpErrorResponse({ status: 0 })),
    });

    await store.listerProduits();

    const resultat = store.resultat();
    expect(resultat.etat).toBe('echec');
    if (resultat.etat === 'echec') {
      expect(resultat.echec.categorie).toBe('injoignable');
    }
  });

  it('journalise l echec AVEC l identifiant de trace', async () => {
    const { store, journal } = configurer({
      produits: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    await store.listerProduits();

    const derniere = journal.lignes.at(-1);
    expect(derniere?.niveau).toBe('error');
    expect((derniere?.champs as Record<string, unknown>)['trace_id']).toBe(TRACE);
  });
});
