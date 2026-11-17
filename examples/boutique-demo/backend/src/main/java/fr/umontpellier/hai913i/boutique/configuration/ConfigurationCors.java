package fr.umontpellier.hai913i.boutique.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS — indispensable, et pas seulement pour que les requêtes passent.
 *
 * <p>L'interface web est servie depuis une autre origine que le service
 * dorsal. Sans autorisation explicite, le navigateur refuse non seulement la
 * réponse, mais aussi l'<b>en-tête {@code traceparent}</b> que
 * l'instrumentation veut ajouter : un en-tête non standard déclenche une
 * requête de contrôle préalable, et s'il n'est pas autorisé, il est retiré.
 * La trace se coupe alors à la frontière — exactement le mode de panne
 * enseigné en section 6.</p>
 *
 * <p>C'est pourquoi {@code traceparent} et {@code tracestate} figurent
 * explicitement dans les en-têtes autorisés.</p>
 */
@Configuration
public class ConfigurationCors implements WebMvcConfigurer {

    @Value("${boutique.origine-frontale:http://localhost:4200}")
    private String origineFrontale;

    @Override
    public void addCorsMappings(CorsRegistry registre) {
        registre.addMapping("/**")
                .allowedOrigins(origineFrontale)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Content-Type", "traceparent", "tracestate", "baggage")
                .maxAge(3600);
    }
}
