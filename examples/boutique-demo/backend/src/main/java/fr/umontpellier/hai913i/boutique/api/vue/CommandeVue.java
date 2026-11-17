package fr.umontpellier.hai913i.boutique.api.vue;

import java.math.BigDecimal;

import fr.umontpellier.hai913i.boutique.domaine.Commande;

/** La commande telle que l'API la rend. Ni courriel, ni mot de passe. */
public record CommandeVue(String reference, int quantite, BigDecimal montant) {

    public static CommandeVue de(Commande c) {
        return new CommandeVue(c.referenceProduit(), c.quantite(), c.montant());
    }
}
