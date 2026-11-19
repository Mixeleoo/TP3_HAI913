package hai913i.tp3.parc.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import hai913i.tp3.parc.service.MouvementImpossible;
import hai913i.tp3.parc.service.StationIndisponible;
import hai913i.tp3.parc.service.StationIntrouvable;

/**
 * Le seul endroit du service qui traduise une faute du métier en réponse
 * HTTP au format {@code ProblemDetail} de la RFC 9457.
 *
 */
@RestControllerAdvice
public class GestionErreurs {

    private static final Logger log = LoggerFactory.getLogger(GestionErreurs.class);

    @ExceptionHandler(StationIntrouvable.class)
    public ProblemDetail introuvable(StationIntrouvable faute) {
        return refus(HttpStatus.NOT_FOUND, faute);
    }

    @ExceptionHandler(MouvementImpossible.class)
    public ProblemDetail conflit(MouvementImpossible faute) {
        return refus(HttpStatus.CONFLICT, faute);
    }

    @ExceptionHandler(StationIndisponible.class)
    public ProblemDetail indisponible(StationIndisponible faute) {
        return refus(HttpStatus.SERVICE_UNAVAILABLE, faute);
    }

    private static ProblemDetail refus(HttpStatus statut, RuntimeException faute) {
        log.atWarn()
        .addKeyValue("motif", faute.getClass().getSimpleName())
        .addKeyValue("statut", statut.value())
        .addKeyValue("detail", faute.getMessage())
        .log("mouvement.refuse");
        return ProblemDetail.forStatusAndDetail(statut, faute.getMessage());
    }
}