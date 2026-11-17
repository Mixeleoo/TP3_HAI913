package fr.umontpellier.hai913i.boutique.service;

/** Faute technique provoquée, pour montrer un span en ERREUR. */
public class DepotIndisponible extends RuntimeException {

    public DepotIndisponible(String message) {
        super(message);
    }
}
