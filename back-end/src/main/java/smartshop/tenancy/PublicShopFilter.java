package smartshop.tenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import smartshop.entity.Shop;
import smartshop.repository.ShopRepository;

import java.io.IOException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Boutique en ligne publique : /shop/{boutique} et /api/public/{boutique}/…
 * La boutique est fixée avant l'ouverture de la session base de données, pour que le catalogue
 * et les commandes ne concernent que cette boutique.
 */
@Component
public class PublicShopFilter extends OncePerRequestFilter {

    private static final Pattern PATH = Pattern.compile("^/(?:shop|api/public)/([a-z0-9-]{1,60})(?:/.*)?$");

    private final ShopRepository shopRepository;

    public PublicShopFilter(ShopRepository shopRepository) {
        this.shopRepository = shopRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !(path.startsWith("/shop/") || path.startsWith("/api/public/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        Matcher m = PATH.matcher(path);
        Optional<Shop> shop = m.matches() ? shopRepository.findBySlug(m.group(1)).filter(Shop::getActive) : Optional.empty();
        if (shop.isEmpty()) {
            response.setStatus(404);
            response.setContentType("application/problem+json;charset=UTF-8");
            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Not Found\",\"status\":404,"
                    + "\"detail\":\"Boutique introuvable\",\"message\":\"Boutique introuvable\"}");
            return;
        }
        TenantContext.set(shop.get().getId());
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
