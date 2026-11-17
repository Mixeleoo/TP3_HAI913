package fr.umontpellier.hai913i.boutique.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import fr.umontpellier.hai913i.boutique.api.vue.CommandeVue;
import fr.umontpellier.hai913i.boutique.api.vue.DemandeCommande;
import fr.umontpellier.hai913i.boutique.api.vue.ProduitVue;
import fr.umontpellier.hai913i.boutique.api.vue.StockVue;
import fr.umontpellier.hai913i.boutique.service.ServiceBoutique;
import jakarta.validation.Valid;

/**
 * Le bord HTTP. Et rien d'autre.
 *
 * <p><b>Ce que cette classe ne fait pas, et c'est le point enseigné :</b></p>
 * <ul>
 *   <li>elle ne <b>journalise pas</b> les requêtes. Le fait « une requête
 *       POST /commandes a reçu 201 » est déjà porté par le span que l'agent
 *       produit, avec sa route, son code et sa durée. Le réécrire dans un
 *       journal, c'est payer deux fois la même information ;</li>
 *   <li>elle ne <b>crée aucun span</b>. Le span serveur existe déjà ;</li>
 *   <li>elle ne <b>calcule rien</b>. Le montant est une décision du métier ;</li>
 *   <li>elle ne <b>traduit aucune erreur</b>. Un seul endroit s'en charge :
 *       {@link GestionErreurs}.</li>
 * </ul>
 *
 * <p>Elle convertit une demande en appel de service, et un résultat du
 * métier en représentation. C'est tout, et c'est suffisant.</p>
 */
@RestController
public class BoutiqueController {

    private final ServiceBoutique service;

    BoutiqueController(ServiceBoutique service) {
        this.service = service;
    }

    @GetMapping("/produits")
    public List<ProduitVue> lister() {
        return service.listerProduits().stream().map(ProduitVue::de).toList();
    }

    @GetMapping("/produits/{reference}")
    public ProduitVue lire(@PathVariable String reference) {
        return ProduitVue.de(service.produit(reference));
    }

    @GetMapping("/produits/{reference}/stock")
    public StockVue stock(@PathVariable String reference) {
        return new StockVue(reference, service.recalculerStock(reference));
    }

    /**
     * Le mot de passe de la demande s'arrête ici : il n'est pas transmis au
     * service. Première ligne de défense — ce qui n'est pas transmis ne peut
     * pas fuir.
     */
    @PostMapping("/commandes")
    public ResponseEntity<CommandeVue> commander(@Valid @RequestBody DemandeCommande demande) {
        var commande = service.validerCommande(
                demande.reference(), demande.quantite(), demande.courriel());
        return ResponseEntity.status(HttpStatus.CREATED).body(CommandeVue.de(commande));
    }

    @GetMapping("/panne")
    public void panne() {
        service.provoquerUnePanne();
    }
}
