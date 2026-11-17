package fr.umontpellier.hai913i.boutique.domaine;

import java.math.BigDecimal;

/**
 * Un produit, tel que le métier le connaît.
 *
 * <p>Aucune annotation : ni JPA, ni Jackson, ni Spring, ni OpenTelemetry.
 * Ce type ignore qu'il existe une base de données, un réseau et de la
 * télémétrie. C'est précisément ce qui permet de changer l'un ou l'autre
 * sans y toucher.</p>
 */
public record Produit(String reference, String libelle, BigDecimal prix) {
}
