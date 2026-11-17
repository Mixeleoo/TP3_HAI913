package fr.umontpellier.hai913i.boutique.depot.jpa;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * L'image du produit EN BASE.
 *
 * <p>Classe distincte du type du domaine, et c'est volontaire : les
 * annotations de persistance restent ici, et {@code Produit} reste pur.</p>
 */
@Entity
@Table(name = "produit")
public class ProduitEntite {

    @Id
    @Column(length = 16)
    private String reference;

    @Column(nullable = false, length = 80)
    private String libelle;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal prix;

    protected ProduitEntite() {
        // requis par JPA
    }

    ProduitEntite(String reference, String libelle, BigDecimal prix) {
        this.reference = reference;
        this.libelle = libelle;
        this.prix = prix;
    }

    String getReference() {
        return reference;
    }

    String getLibelle() {
        return libelle;
    }

    BigDecimal getPrix() {
        return prix;
    }
}
