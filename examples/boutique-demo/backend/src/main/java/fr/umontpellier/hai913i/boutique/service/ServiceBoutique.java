package fr.umontpellier.hai913i.boutique.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import fr.umontpellier.hai913i.boutique.depot.ProduitDepot;
import fr.umontpellier.hai913i.boutique.domaine.Commande;
import fr.umontpellier.hai913i.boutique.domaine.Produit;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.instrumentation.annotations.WithSpan;

/**
 * Les règles du métier — et le seul endroit du service dorsal où l'on
 * instrumente à la main.
 *
 * <p><b>Pourquoi ici et nulle part ailleurs.</b> L'agent OpenTelemetry voit
 * les bords : la requête HTTP entrante, la requête SQL sortante. Il ne peut
 * pas savoir qu'une <i>commande a été validée</i>, ni pour quel montant.
 * Cette connaissance-là n'existe que dans la couche qui porte la décision,
 * c'est-à-dire ici.</p>
 *
 * <p><b>Ce qu'on n'a surtout pas fait.</b> Recréer à la main un span pour la
 * requête HTTP ou pour l'accès à la base : l'agent les produit déjà,
 * correctement nommés et conformes aux conventions sémantiques. Les
 * dupliquer produirait deux spans pour un seul travail.</p>
 *
 * <p>Aucune annotation web n'existe dans cette classe : elle ignore qu'il
 * existe un protocole HTTP. Elle rend des objets du métier ou lève une faute
 * du métier ; c'est la couche API qui décidera du code de statut.</p>
 */
@Service
public class ServiceBoutique {

    private static final Logger log = LoggerFactory.getLogger(ServiceBoutique.class);

    /** Seuil au-dessous duquel le stock mérite un avertissement. */
    private static final int SEUIL_STOCK_BAS = 5;

    private final ProduitDepot depot;

    /**
     * Tracer d'instrumentation manuelle. Sans agent, il est no-op : le
     * service fonctionne à l'identique et n'émet simplement aucune trace.
     */
    private final Tracer tracer;

    ServiceBoutique(ProduitDepot depot, Tracer tracer) {
        this.depot = depot;
        this.tracer = tracer;
    }

    public List<Produit> listerProduits() {
        return depot.tous();
    }

    public Produit produit(String reference) {
        return depot.parReference(reference)
                .orElseThrow(() -> new ProduitIntrouvable(reference));
    }

    /**
     * Opération volontairement lente : c'est elle qui doit dominer la
     * cascade dans la trace.
     *
     * <p>Le span est posé par une annotation plutôt que par du code : c'est
     * la forme la plus légère d'instrumentation manuelle, et elle suffit
     * quand on veut seulement faire apparaître une étape. Quand il faut en
     * plus porter des attributs du métier, on écrit le span explicitement —
     * voir {@link #validerCommande}.</p>
     *
     * <p>La latence est <b>déterministe</b> : une capture de cours doit se
     * rejouer à l'identique devant la salle.</p>
     */
    @WithSpan("boutique.recalculer_stock")
    public int recalculerStock(String reference) {
        Produit produit = produit(reference);
        attendre(500);
        int restant = Math.floorMod(produit.reference().hashCode(), 11);
        if (restant < SEUIL_STOCK_BAS) {
            //  Inattendu, mais le traitement continue : c'est la définition
            //  même de WARN.
            log.warn("stock bas reference={} restant={} seuil={}",
                     reference, restant, SEUIL_STOCK_BAS);
        }
        return restant;
    }

    /**
     * Le jalon métier de la démonstration.
     *
     * <p>C'est le seul span écrit explicitement dans tout le service dorsal,
     * et il porte ce que l'agent ne peut pas deviner : la référence, la
     * quantité, le montant, et un événement de paiement.</p>
     *
     * <p><b>Et ce qui n'y entre pas.</b> La demande porte un courriel et un
     * mot de passe. Le mot de passe n'apparaît nulle part : ni dans le
     * journal, ni dans la trace, ni dans un attribut. Du courriel, on ne
     * retient que le <i>domaine</i> — ce qui suffit à la seule question
     * qu'on se pose (d'où viennent les clients) et ne singularise
     * personne.</p>
     */
    public Commande validerCommande(String reference, int quantite, String courriel) {
        Produit produit = produit(reference);
        BigDecimal montant = produit.prix()
                .multiply(BigDecimal.valueOf(quantite))
                .setScale(2, RoundingMode.HALF_UP);
        String domaine = domaineDe(courriel);

        Span span = tracer.spanBuilder("boutique.commande_validee").startSpan();
        try (var ignore = span.makeCurrent()) {
            span.setAttribute("commande.reference_produit", produit.reference());
            span.setAttribute("commande.quantite", quantite);
            span.setAttribute("commande.montant_eur", montant.doubleValue());
            span.setAttribute("client.domaine", domaine);
            span.addEvent("paiement.accepte",
                          Attributes.of(AttributeKey.stringKey("moyen"), "carte"));

            //  Journal STRUCTURÉ : le nom de l'événement est stable, les
            //  valeurs sont des champs typés. API fluide de SLF4J 2.
            log.atInfo()
               .setMessage("boutique.commande_validee")
               .addKeyValue("commande.reference_produit", produit.reference())
               .addKeyValue("commande.quantite", quantite)
               .addKeyValue("commande.montant_eur", montant)
               .addKeyValue("client.domaine", domaine)
               .log();

            return new Commande(produit.reference(), quantite, montant, domaine);
        } finally {
            span.end();
        }
    }

    /** Panne provoquée : sert à montrer un span en ERROR et sa corrélation. */
    public void provoquerUnePanne() {
        throw new DepotIndisponible("dépôt indisponible");
    }

    /** Ne garde que le domaine : « a.b@exemple.fr » devient « exemple.fr ». */
    static String domaineDe(String courriel) {
        if (courriel == null) {
            return "inconnu";
        }
        int arobase = courriel.lastIndexOf('@');
        return arobase < 0 ? "invalide" : courriel.substring(arobase + 1);
    }

    private static void attendre(int millisecondes) {
        try {
            Thread.sleep(millisecondes);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
