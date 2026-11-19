package hai913i.tp3.locations.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import hai913i.tp3.locations.parc.MouvementRefuse;
import hai913i.tp3.locations.parc.ParcIndisponible;
import hai913i.tp3.locations.parc.StationInconnue;
import hai913i.tp3.locations.service.AbonneRefuse;
import hai913i.tp3.locations.service.LocationDejaCloturee;
import hai913i.tp3.locations.service.LocationIntrouvable;

/**
 * Le seul endroit du service qui traduise une faute du métier en réponse
 * HTTP au format {@code ProblemDetail} de la RFC 9457.
 *
 * <p>Un refus du parc reste un conflit (409), tandis qu'une indisponibilité du
 * parc devient une indisponibilité de ce service (503).
 * Un appelant qui ne verrait qu'un code 500
 * ne saurait pas lequel des deux services est en cause.</p>
 */
@RestControllerAdvice
public class GestionErreurs {

    private static final Logger log = LoggerFactory.getLogger(GestionErreurs.class);

    @ExceptionHandler({LocationIntrouvable.class, StationInconnue.class})
    public ProblemDetail introuvable(RuntimeException faute) {
        return refus(Level.WARN, HttpStatus.NOT_FOUND, faute);
    }

    @ExceptionHandler({LocationDejaCloturee.class, MouvementRefuse.class})
    public ProblemDetail conflit(RuntimeException faute) {
        return refus(Level.WARN, HttpStatus.CONFLICT, faute);
    }

    @ExceptionHandler(AbonneRefuse.class)
    public ProblemDetail refuse(AbonneRefuse faute) {
        return refus(Level.WARN, HttpStatus.UNAUTHORIZED, faute);
    }

    @ExceptionHandler(ParcIndisponible.class)
    public ProblemDetail indisponible(ParcIndisponible faute) {
        Level niveau = faute.getCause() != null ? Level.ERROR : Level.WARN;
        return refus(niveau, HttpStatus.SERVICE_UNAVAILABLE, faute);
    }

    private static ProblemDetail refus(Level niveau, HttpStatus statut, RuntimeException faute) {
        log.atLevel(niveau).setCause(niveau == Level.ERROR ? faute : null)
        .addKeyValue("motif", faute.getClass().getSimpleName())
        .addKeyValue("statut", statut.value())
        .addKeyValue("origine", origine(faute))
        .addKeyValue("detail", faute.getMessage())
        .log("location.echec");
        return ProblemDetail.forStatusAndDetail(statut, faute.getMessage());
    }

    private static String origine(RuntimeException faute) {
        return faute instanceof MouvementRefuse || faute instanceof StationInconnue
                || faute instanceof ParcIndisponible ? "parc" : "locations";
    }
}
