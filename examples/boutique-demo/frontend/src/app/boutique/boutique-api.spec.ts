/**
 * L'accès au service dorsal : routes, charges utiles, échecs.
 *
 * <p>Aucun réseau, aucun Collector, aucun Jaeger.
 * `provideHttpClientTesting` remplace le transport,
 * et `HttpTestingController` permet d'affirmer ce qui
 * est PARTI et ce qui est revenu.</p>
 */
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CONFIGURATION } from '../core/configuration';
import { BoutiqueApi } from './boutique-api';
import { DemandeCommande } from './boutique-models';

const DORSAL = 'http://dorsal.test';

describe('BoutiqueApi', () => {
  let api: BoutiqueApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        //  `provideHttpClientTesting` remplace une partie
        //  de ce que `provideHttpClient` a posé.
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CONFIGURATION,
          useValue: {
            urlDorsal: DORSAL,
            urlCollecteurOtlp: 'http://collecteur.test/v1/traces',
            nomService: 'boutique-frontend',
            versionService: 'test',
            propagationCassee: false,
          },
        },
      ],
    });
    api = TestBed.inject(BoutiqueApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lit le catalogue sur GET /produits', async () => {
    const promesse = firstValueFrom(api.produits());
    const attendu = [{ reference: 'P-1', libelle: 'Un', prix: 10 }];
    const requete = httpMock.expectOne(`${DORSAL}/produits`);

    expect(requete.request.method).toBe('GET');
    requete.flush(attendu);
    expect(await promesse).toEqual(attendu);
  });

  it('lit un produit sur GET /produits/{reference}', async () => {
    const promesse = firstValueFrom(api.produit('P-1002'));
    const attendu = { reference: 'P-1002', libelle: 'Deux', prix: 20 };
    const requete = httpMock.expectOne(`${DORSAL}/produits/P-1002`);

    expect(requete.request.method).toBe('GET');
    requete.flush(attendu);
    expect((await promesse).reference).toBe('P-1002');
  });

  it('lit le stock sur GET /produits/{reference}/stock', async () => {
    const promesse = firstValueFrom(api.stock('P-1003'));
    const attendu = { reference: 'P-1003', restant: 3 };
    const requete = httpMock.expectOne(`${DORSAL}/produits/P-1003/stock`);

    expect(requete.request.method).toBe('GET');
    requete.flush(attendu);
    expect((await promesse).restant).toBe(3);
  });

  it('poste une commande portant volontairement le secret', async () => {
    const promesse = firstValueFrom(api.commander('P-1003', 2));
    const attendu = { reference: 'P-1003', quantite: 2, montant: 79 };
    const requete = httpMock.expectOne(`${DORSAL}/commandes`);
    
    expect(requete.request.method).toBe('POST');

    //  Le secret DOIT partir :
    //  C'est ce qui rend vérifiable son absence des journaux et des spans.
    const envoye = requete.request.body as DemandeCommande;
    expect(envoye.reference).toBe('P-1003');
    expect(envoye.quantite).toBe(2);
    expect(envoye.motDePasse).toBeTruthy();
    expect(envoye.courriel).toContain('@');
    requete.flush(attendu);
    expect((await promesse).montant).toBe(79);
  });

  it('appelle GET /panne', async () => {
    const promesse = firstValueFrom(api.panne());
    httpMock.expectOne(`${DORSAL}/panne`).flush(null);
    await promesse;
  });

  it('laisse remonter un echec HTTP sans le traduire', async () => {
    const promesse = firstValueFrom(api.panne());
    httpMock
      .expectOne(`${DORSAL}/panne`)
      .flush({ detail: 'dépôt indisponible' }, { status: 503, statusText: 'x' });
    //  La couche d'accès ne construit pas de message : elle laisse passer.
    //  C'est `boutique-errors.ts` qui traduit.
    await expect(promesse).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
