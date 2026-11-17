package fr.umontpellier.hai913i.boutique.api.vue;

import java.math.BigDecimal;

import fr.umontpellier.hai913i.boutique.domaine.Produit;

/**
 * Le produit tel que l'API l'expose.
 *
 * <p>Distinct du type du domaine : on choisit ce qui sort, et le jour où le
 * domaine gagne un champ, l'API ne le publie pas par accident.</p>
 */
public record ProduitVue(String reference, String libelle, BigDecimal prix) {

    public static ProduitVue de(Produit p) {
        return new ProduitVue(p.reference(), p.libelle(), p.prix());
    }
}
