package fr.umontpellier.hai913i.boutique.api;

import java.net.URI;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import fr.umontpellier.hai913i.boutique.service.DepotIndisponible;
import fr.umontpellier.hai913i.boutique.service.ProduitIntrouvable;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;

/**
 * Un seul endroit traduit les fautes du métier en réponses HTTP.
 *
 * <p>Format RFC 9457 : {@code application/problem+json}, rendu nativement
 * par {@code ProblemDetail} depuis Spring Framework 6.</p>
 *
 * <p><b>Pourquoi il y a de l'OpenTelemetry ici, alors que le contrôleur n'en
 * a pas.</b> Un code HTTP 5xx n'est pas automatiquement un span en erreur :
 * marquer le statut est une décision, et elle se prend au seul endroit qui
 * sait si l'échec est une faute du service ou une demande mal formée. Un 404
 * sur une référence inconnue n'est pas une panne — le span reste UNSET.
 * Une indisponibilité en est une — le span passe en ERROR.</p>
 */
@RestControllerAdvice
public class GestionErreurs {

    private static final Logger log = LoggerFactory.getLogger(GestionErreurs.class);
    private static final String BASE = "https://hai913i.umontpellier.fr/probleme/";

    private static ProblemDetail probleme(HttpStatus statut, String type, String titre,
                                          String detail) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(statut, detail);
        p.setType(URI.create(BASE + type));
        p.setTitle(titre);
        return p;
    }

    /**
     * 404. Le span n'est PAS marqué en erreur : la ressource n'existe pas,
     * le service a parfaitement fonctionné.
     */
    @ExceptionHandler(ProduitIntrouvable.class)
    ProblemDetail introuvable(ProduitIntrouvable e) {
        return probleme(HttpStatus.NOT_FOUND, "produit-inconnu",
                        "Produit inconnu", e.getMessage());
    }

    /** 503. Là, c'est une panne : le span le dit, et le journal l'explique. */
    @ExceptionHandler(DepotIndisponible.class)
    ProblemDetail indisponible(DepotIndisponible e) {
        Span span = Span.current();
        span.setStatus(StatusCode.ERROR, e.getMessage());
        span.recordException(e);
        log.error("echec de l'operation, depot indisponible", e);
        return probleme(HttpStatus.SERVICE_UNAVAILABLE, "depot-indisponible",
                        "Service temporairement indisponible", e.getMessage());
    }
}
