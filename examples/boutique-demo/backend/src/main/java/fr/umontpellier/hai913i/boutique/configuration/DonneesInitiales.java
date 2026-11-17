package fr.umontpellier.hai913i.boutique.configuration;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;

import fr.umontpellier.hai913i.boutique.depot.ProduitDepot;
import fr.umontpellier.hai913i.boutique.domaine.Produit;
import jakarta.annotation.PostConstruct;

/**
 * Amorçage : trois produits, pour que le service soit utilisable aussitôt.
 *
 * <p><b>Pourquoi {@code @PostConstruct} et non un {@code ApplicationRunner}.</b>
 * Spring Boot appelle les {@code ApplicationRunner} <i>après</i> avoir
 * démarré Tomcat et journalisé « Started Application ». Le port écoute donc
 * avant que les données soient là, et un script qui attend l'ouverture du
 * port peut interroger un catalogue encore vide. C'est exactement ce qui est
 * arrivé pendant la mise au point : une capture montrait
 * {@code lecture du catalogue nombre=0} alors que la lecture d'un produit
 * précis réussissait deux secondes plus tard.</p>
 *
 * <p>Un {@code @PostConstruct} s'exécute pendant le rafraîchissement du
 * contexte, donc <b>avant</b> que le serveur accepte la moindre connexion.
 * La démonstration redevient reproductible — et c'est la seule chose qui
 * compte pour un support de cours.</p>
 */
@Component
public class DonneesInitiales {

    private final ProduitDepot depot;

    DonneesInitiales(ProduitDepot depot) {
        this.depot = depot;
    }

    @PostConstruct
    void amorcer() {
        if (depot.compter() > 0) {
            return;
        }
        depot.enregistrer(new Produit("P-1001", "Clavier mécanique",
                                      new BigDecimal("89.90")));
        depot.enregistrer(new Produit("P-1002", "Écran 27 pouces",
                                      new BigDecimal("249.00")));
        depot.enregistrer(new Produit("P-1003", "Casque filaire",
                                      new BigDecimal("39.50")));
    }
}
