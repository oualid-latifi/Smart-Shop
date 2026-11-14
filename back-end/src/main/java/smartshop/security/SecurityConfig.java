package smartshop.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import smartshop.repository.AppUserRepository;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // On gère la connexion nous-mêmes : ce bean empêche Spring de créer un mot de passe automatique
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Non utilisé");
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtService jwtService,
                                                   AppUserRepository userRepository) throws Exception {
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtService, userRepository);

        http
                .csrf(csrf -> csrf.disable())              // pas de cookies : le token est dans le header
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/status", "/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/verify/**").permitAll()
                        // Comptes, journal, objectifs, paramètres
                        .requestMatchers("/api/users/**", "/api/activity/**").hasAuthority("USERS")
                        .requestMatchers(HttpMethod.PUT, "/api/targets/**").hasAuthority("USERS")
                        .requestMatchers(HttpMethod.PUT, "/api/settings", "/api/settings/**").hasAuthority("SETTINGS")
                        .requestMatchers(HttpMethod.GET, "/api/promotions/**").authenticated()
                        .requestMatchers("/api/promotions/**").hasAuthority("PRODUCTS_WRITE")
                        .requestMatchers("/api/import/**", "/api/backups/**").hasAuthority("SETTINGS")
                        .requestMatchers("/api/cash/**").hasAuthority("CASH")
                        // Ventes et devis
                        .requestMatchers(HttpMethod.POST, "/api/sales/*/cancel").hasAuthority("SALES_CANCEL")
                        .requestMatchers("/api/sales/**", "/api/quotes/**").hasAnyAuthority("SALES", "PAYMENTS", "REPORTS")
                        // Clients et encaissements
                        .requestMatchers("/api/customers/*/payments", "/api/checks/**", "/api/customers/aging").hasAuthority("PAYMENTS")
                        .requestMatchers("/api/customers/**").hasAnyAuthority("CUSTOMERS", "PAYMENTS")
                        // Produits et stock
                        .requestMatchers(HttpMethod.GET, "/api/products/**").authenticated()
                        .requestMatchers("/api/products/**").hasAuthority("PRODUCTS_WRITE")
                        .requestMatchers(HttpMethod.POST, "/api/purchase-orders/*/receive").hasAnyAuthority("STOCK", "PURCHASES")
                        .requestMatchers("/api/stock/**", "/api/inventories/**", "/api/warehouses/**").hasAuthority("STOCK")
                        .requestMatchers("/api/purchases/**", "/api/purchase-orders/**", "/api/suppliers/**").hasAnyAuthority("PURCHASES", "STOCK")
                        // Rapports et dépenses
                        .requestMatchers("/api/reports/**", "/api/expenses/**").hasAuthority("REPORTS")
                        .anyRequest().authenticated())
                // En plus des en-têtes par défaut de Spring Security (X-Frame-Options, nosniff, HSTS en HTTPS…)
                .headers(h -> h
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
                .exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
                    // Même format que GlobalExceptionHandler (RFC 9457)
                    String detail = "Non connecté : token manquant, invalide ou expiré";
                    response.setStatus(401);
                    response.setContentType("application/problem+json;charset=UTF-8");
                    response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Unauthorized\",\"status\":401,"
                            + "\"detail\":\"" + detail + "\",\"message\":\"" + detail + "\"}");
                })
                        .accessDeniedHandler((request, response, ex) -> {
                            String detail = "Ton compte n'a pas accès à cette fonction";
                            response.setStatus(403);
                            response.setContentType("application/problem+json;charset=UTF-8");
                            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,"
                                    + "\"detail\":\"" + detail + "\",\"message\":\"" + detail + "\"}");
                        }))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}