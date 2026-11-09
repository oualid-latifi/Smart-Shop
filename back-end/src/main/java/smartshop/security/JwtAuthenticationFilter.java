package smartshop.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import smartshop.repository.AppUserRepository;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Lit le header "Authorization: Bearer <token>" et connecte l'utilisateur si le token est valide.
 * Ce filtre n'est volontairement PAS un @Component : il est créé dans SecurityConfig.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AppUserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, AppUserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            authenticate(header.substring(7).trim());
        }
        chain.doFilter(request, response);
    }

    static List<SimpleGrantedAuthority> authorities(smartshop.entity.AppUser user) {
        java.util.ArrayList<SimpleGrantedAuthority> list = new java.util.ArrayList<>();
        list.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        user.getRole().getPermissions().forEach(p -> list.add(new SimpleGrantedAuthority(p.name())));
        return list;
    }

    private void authenticate(String token) {
        jwtService.parse(token).ifPresent(claims -> {
            try {
                UUID userId = UUID.fromString(claims.getSubject());
                Integer version = claims.get("ver", Integer.class);

                userRepository.findById(userId)
                        .filter(user -> version != null && version == user.getTokenVersion() && user.isActive())
                        .ifPresent(user -> {
                            UsernamePasswordAuthenticationToken authentication =
                                    new UsernamePasswordAuthenticationToken(
                                            user, null, authorities(user));
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                        });
            } catch (IllegalArgumentException ignored) {
                // token mal formé : on ne connecte personne
            }
        });
    }
}