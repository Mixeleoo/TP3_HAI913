package fr.umontpellier.hai913i.boutique.api.vue;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * La demande de commande.
 *
 * <p><b>Elle porte volontairement un secret.</b> Le mot de passe est ici
 * pour que la démonstration de confidentialité ait quelque chose à
 * démontrer : un contrôle automatique vérifie ensuite qu'il ne ressort
 * d'aucune sortie — journal, trace, attribut de span, Collector, Jaeger.</p>
 *
 * <p>Le champ n'est jamais passé au service : la couche API le laisse
 * tomber ici. C'est la première ligne de défense, et la seule qui compte
 * vraiment : ce qui n'est pas transmis ne peut pas fuir.</p>
 */
public record DemandeCommande(
        @NotBlank String reference,
        @Min(1) @Max(99) int quantite,
        @Email @NotBlank String courriel,
        String motDePasse) {
}
