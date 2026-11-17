package fr.umontpellier.hai913i.boutique.domaine;

import java.math.BigDecimal;

/**
 * Une commande validée.
 *
 * <p>Objet du métier, et non représentation d'API : il ne porte ni le
 * courriel du client, ni a fortiori son mot de passe. Ce n'est pas une
 * omission, c'est une décision — voir {@code ServiceBoutique} et la
 * section « vie privée » du cours.</p>
 */
public record Commande(String referenceProduit,
                       int quantite,
                       BigDecimal montant,
                       String domaineClient) {
}
