package fr.umontpellier.hai913i.boutique.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import fr.umontpellier.hai913i.boutique.depot.ProduitDepot;
import fr.umontpellier.hai913i.boutique.domaine.Commande;
import fr.umontpellier.hai913i.boutique.domaine.Produit;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Tracer;

/**
 * Tests du métier.
 *
 * <p>Ils tournent <b>sans agent et sans SDK</b> : le tracer no-op d'OpenTelemetry
 * suffit. C'est en soi une vérification utile — si le métier ne compilait
 * ou ne s'exécutait qu'en présence d'un agent, c'est que l'instrumentation
 * aurait envahi le code.</p>
 */
class ServiceBoutiqueTest {

    private static final Tracer NO_OP = OpenTelemetry.noop().getTracer("test");

    /** Dépôt en mémoire, local au test : pas de base, pas de Spring. */
    private static ProduitDepot depot(Produit... produits) {
        List<Produit> contenu = new ArrayList<>(List.of(produits));
        return new ProduitDepot() {
            @Override
            public List<Produit> tous() {
                return List.copyOf(contenu);
            }

            @Override
            public Optional<Produit> parReference(String reference) {
                return contenu.stream()
                        .filter(p -> p.reference().equals(reference))
                        .findFirst();
            }

            @Override
            public long compter() {
                return contenu.size();
            }

            @Override
            public Produit enregistrer(Produit produit) {
                contenu.add(produit);
                return produit;
            }
        };
    }

    private static final Produit CASQUE =
            new Produit("P-1003", "Casque filaire", new BigDecimal("39.50"));

    @Test
    void calculeLeMontantDeLaCommande() {
        var service = new ServiceBoutique(depot(CASQUE), NO_OP);
        Commande c = service.validerCommande("P-1003", 2, "lea.martin@etu.umontpellier.fr");
        assertEquals(new BigDecimal("79.00"), c.montant());
        assertEquals(2, c.quantite());
    }

    @Test
    void neRetientQueLeDomaineDuCourriel() {
        var service = new ServiceBoutique(depot(CASQUE), NO_OP);
        Commande c = service.validerCommande("P-1003", 1, "lea.martin@etu.umontpellier.fr");
        assertEquals("etu.umontpellier.fr", c.domaineClient());
    }

    @Test
    void laCommandeNePorteNiCourrielNiMotDePasse() {
        var service = new ServiceBoutique(depot(CASQUE), NO_OP);
        Commande c = service.validerCommande("P-1003", 1, "lea.martin@etu.umontpellier.fr");
        //  Le record du domaine n'a tout simplement pas de champ pour cela :
        //  la garantie est structurelle, pas déclarative.
        assertEquals(4, Commande.class.getRecordComponents().length);
        assertEquals("P-1003", c.referenceProduit());
    }

    @Test
    void refuseUneReferenceInconnue() {
        var service = new ServiceBoutique(depot(CASQUE), NO_OP);
        assertThrows(ProduitIntrouvable.class, () -> service.produit("P-9999"));
    }

    @Test
    void leStockEstDeterministe() {
        var service = new ServiceBoutique(depot(CASQUE), NO_OP);
        assertEquals(service.recalculerStock("P-1003"), service.recalculerStock("P-1003"));
    }

    @Test
    void extraitLeDomaineOuDitPourquoiIlNeLePeutPas() {
        assertEquals("exemple.fr", ServiceBoutique.domaineDe("a.b@exemple.fr"));
        assertEquals("invalide", ServiceBoutique.domaineDe("sans-arobase"));
        assertEquals("inconnu", ServiceBoutique.domaineDe(null));
    }
}
