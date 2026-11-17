package fr.umontpellier.hai913i.boutique.depot;

import java.util.List;
import java.util.Optional;

import fr.umontpellier.hai913i.boutique.domaine.Produit;

/**
 * La frontière de persistance, vue par le métier.
 *
 * <p>Le service ne sait pas s'il y a une base de données derrière. C'est ce
 * qui permet, du point de vue de l'observabilité, de poser une question
 * simple et instructive : <b>quelle couche doit journaliser quoi ?</b>
 * Ici, les faits de stockage — et eux seuls.</p>
 */
public interface ProduitDepot {

    List<Produit> tous();

    Optional<Produit> parReference(String reference);

    long compter();

    Produit enregistrer(Produit produit);
}
