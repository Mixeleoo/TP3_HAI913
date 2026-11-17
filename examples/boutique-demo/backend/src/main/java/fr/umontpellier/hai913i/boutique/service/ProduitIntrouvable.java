package fr.umontpellier.hai913i.boutique.service;

/** Faute du métier : la référence demandée n'existe pas. */
public class ProduitIntrouvable extends RuntimeException {

    private final String reference;

    public ProduitIntrouvable(String reference) {
        super("produit introuvable : " + reference);
        this.reference = reference;
    }

    public String reference() {
        return reference;
    }
}
