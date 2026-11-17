package fr.umontpellier.hai913i.boutique.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Tracer;

/**
 * Le seul point du service dorsal qui connaisse le SDK OpenTelemetry.
 *
 * <p>Sans cette classe, chaque composant qui veut instrumenter irait
 * chercher {@code GlobalOpenTelemetry} lui-même — et l'application
 * dépendrait de la télémétrie partout. Ici, un seul {@code Tracer} est
 * publié, et le service le reçoit par injection comme n'importe quelle
 * dépendance.</p>
 *
 * <p>Quand l'agent est absent, {@code GlobalOpenTelemetry} rend une
 * implémentation no-op : le {@code Tracer} existe toujours, il n'émet
 * simplement rien. Aucune branche conditionnelle n'est nécessaire dans le
 * code du métier.</p>
 */
@Configuration
public class ConfigurationTelemetrie {

    @Bean
    Tracer tracerBoutique() {
        return GlobalOpenTelemetry.getTracer("fr.umontpellier.hai913i.boutique", "1.0.0");
    }
}
