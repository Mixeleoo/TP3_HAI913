package fr.umontpellier.hai913i.boutique.depot.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

/** Dépôt Spring Data : l'implémentation est engendrée à l'exécution. */
public interface ProduitJpa extends JpaRepository<ProduitEntite, String> {
}
