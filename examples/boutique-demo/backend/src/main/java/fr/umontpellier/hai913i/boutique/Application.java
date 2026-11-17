package fr.umontpellier.hai913i.boutique;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Démonstration du CM 04 (HAI913I, 2026-2027) — service dorsal.
 *
 * <p>Service volontairement petit, mais stratifié comme une vraie
 * application : {@code api} / {@code service} / {@code depot} /
 * {@code domaine}. C'est l'architecture qui rend visible la question du
 * cours : <b>quelle couche doit journaliser quoi, et où faut-il
 * instrumenter à la main ?</b></p>
 *
 * <p>Le même binaire se lance de deux façons :</p>
 * <ul>
 *   <li><b>sans agent</b> — il journalise, et rien de plus ;</li>
 *   <li><b>avec {@code -javaagent:opentelemetry-javaagent.jar}</b> — les
 *       mêmes lignes de journal portent en plus un {@code trace_id} et un
 *       {@code span_id}, et des spans apparaissent : requête HTTP, requête
 *       SQL, et le span métier écrit à la main.</li>
 * </ul>
 */
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
