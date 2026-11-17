/**
 * La page délègue et reflète, sans aucune décision.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { BoutiquePage } from './boutique-page';
import { BoutiqueStore, Resultat } from './boutique-store';

describe('BoutiquePage', () => {
  function configurer() {
    const appels: string[] = [];
    const produits = signal<readonly { reference: string; libelle: string; prix: number }[]>([]);
    const resultat = signal<Resultat>({ etat: 'vide' });
    const trace = signal('');
    const enCours = signal(false);

    const store = {
      produits,
      resultat,
      trace,
      enCours,
      listerProduits: async () => void appels.push('lister'),
      voirProduit: async (r: string) => void appels.push('produit:' + r),
      voirStock: async (r: string) => void appels.push('stock:' + r),
      commander: async (r: string) => void appels.push('commande:' + r),
      provoquerPanne: async () => void appels.push('panne'),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: BoutiqueStore, useValue: store }],
    });
    const fixture = TestBed.createComponent(BoutiquePage);
    fixture.detectChanges();
    return { fixture, appels, produits, resultat, trace };
  }

  it('affiche un tiret tant qu aucun geste n a eu lieu', () => {
    const { fixture } = configurer();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('delegue chaque bouton au magasin, dans l ordre du gabarit', () => {
    const { fixture, appels } = configurer();
    const boutons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(boutons.length).toBe(5);
    boutons.forEach((b) => b.click());
    expect(appels).toEqual([
      'lister',
      'produit:P-1002',
      'stock:P-1003',
      'commande:P-1003',
      'panne',
    ]);
  });

  it('reflete le resultat et la trace venus du magasin', () => {
    const { fixture, resultat, trace } = configurer();
    resultat.set({ etat: 'succes', message: '3 produits au catalogue' });
    trace.set('0af7651916cd43dd8448eb211c80319c');
    fixture.detectChanges();

    const texte = fixture.nativeElement.textContent as string;
    expect(texte).toContain('3 produits au catalogue');
    expect(texte).toContain('0af7651916cd43dd8448eb211c80319c');
  });

  it('affiche la categorie quand le geste echoue', () => {
    const { fixture, resultat } = configurer();
    resultat.set({
      etat: 'echec',
      echec: { categorie: 'injoignable', message: 'service dorsal injoignable' },
    });
    fixture.detectChanges();

    const texte = fixture.nativeElement.textContent as string;
    expect(texte).toContain('service dorsal injoignable');
    expect(texte).toContain('injoignable');
  });

  it('affiche le catalogue recu', () => {
    const { fixture, produits } = configurer();
    produits.set([{ reference: 'P-1002', libelle: 'Clavier', prix: 42 }]);
    fixture.detectChanges();

    const texte = fixture.nativeElement.textContent as string;
    expect(texte).toContain('P-1002');
    expect(texte).toContain('Clavier');
  });
});
