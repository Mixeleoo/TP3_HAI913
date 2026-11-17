package fr.umontpellier.hai913i.boutique.depot.jpa;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import fr.umontpellier.hai913i.boutique.depot.ProduitDepot;
import fr.umontpellier.hai913i.boutique.domaine.Produit;

/**
 * Réalisation JPA du dépôt.
 *
 * <p><b>Ce que cette couche journalise, et seulement cela.</b> Des faits de
 * <i>stockage</i> : ce qui a été lu, ce qui n'a pas été trouvé. Pas de
 * jalons métier — ils appartiennent au service ; pas de faits HTTP — ils
 * appartiennent au bord, et l'agent les porte déjà.</p>
 *
 * <p><b>Ce qu'elle n'instrumente pas à la main.</b> Rien. L'agent
 * OpenTelemetry instrumente le pilote JDBC : la requête SQL apparaîtra dans
 * la trace sans qu'une seule ligne soit écrite ici. C'est la démonstration la
 * plus nette de ce qu'apporte l'instrumentation zéro-code sur une
 * bibliothèque qu'on n'a pas écrite.</p>
 */
@Repository
public class ProduitDepotJpa implements ProduitDepot {

    private static final Logger log = LoggerFactory.getLogger(ProduitDepotJpa.class);

    private final ProduitJpa jpa;

    ProduitDepotJpa(ProduitJpa jpa) {
        this.jpa = jpa;
    }

    @Override
    public List<Produit> tous() {
        List<Produit> produits = jpa.findAll().stream()
                .map(ProduitDepotJpa::versDomaine)
                .sorted(Comparator.comparing(Produit::reference))
                .toList();
        log.debug("lecture du catalogue nombre={}", produits.size());
        return produits;
    }

    @Override
    public Optional<Produit> parReference(String reference) {
        Optional<Produit> trouve = jpa.findById(reference).map(ProduitDepotJpa::versDomaine);
        if (trouve.isEmpty()) {
            //  WARN et non ERROR : rien n'a échoué côté stockage, la ligne
            //  n'existe simplement pas. C'est au service de décider si c'est
            //  une faute du métier.
            log.warn("produit absent du depot reference={}", reference);
        }
        return trouve;
    }

    @Override
    public long compter() {
        return jpa.count();
    }

    @Override
    public Produit enregistrer(Produit produit) {
        jpa.save(new ProduitEntite(produit.reference(), produit.libelle(), produit.prix()));
        return produit;
    }

    private static Produit versDomaine(ProduitEntite e) {
        return new Produit(e.getReference(), e.getLibelle(), e.getPrix());
    }
}
