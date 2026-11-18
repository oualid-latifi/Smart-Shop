package smartshop.service;

import smartshop.exception.ResourceNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.AuthResponse;
import smartshop.dto.ChangePasswordRequest;
import smartshop.dto.EmployeeRegisterRequest;
import smartshop.dto.LoginRequest;
import smartshop.dto.RegisterRequest;
import smartshop.dto.UserResponse;
import smartshop.entity.AppUser;
import smartshop.exception.InvalidCredentialsException;
import smartshop.repository.AppUserRepository;
import smartshop.security.JwtService;
import smartshop.security.LoginAttemptService;

import java.util.UUID;

@Service
public class AuthService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttemptService;
    private final ShopService shopService;

    public AuthService(AppUserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       LoginAttemptService loginAttemptService,
                       ShopService shopService) {
        this.shopService = shopService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginAttemptService = loginAttemptService;
    }

    @Transactional(readOnly = true)
    public boolean accountExists() {
        return userRepository.count() > 0;
    }

    /** Un nouveau propriétaire crée sa boutique : ses données sont séparées de celles des autres boutiques. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalize(request.email());
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Un compte utilise déjà cet email : connecte-toi");
        }
        String shopName = request.shopName() != null && !request.shopName().isBlank()
                ? request.shopName().trim() : "Boutique de " + request.name().trim();
        smartshop.entity.Shop shop = shopService.create(shopName);
        AppUser user = new AppUser();
        user.setShopId(shop.getId());
        user.setName(request.name().trim());
        user.setEmail(normalize(request.email()));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(smartshop.entity.Role.OWNER);
        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalize(request.email());
        loginAttemptService.checkAllowed(email);

        // Même message d'erreur si l'email n'existe pas ou si le mot de passe est faux
        AppUser user = userRepository.findByEmail(email)
                .filter(u -> u.isActive() && passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElse(null);
        if (user == null) {
            loginAttemptService.onFailure(email);
            throw new InvalidCredentialsException();
        }
        loginAttemptService.onSuccess(email);
        return toResponse(user);
    }

    /**
     * Un employé crée son compte depuis l'écran de connexion, devant le propriétaire qui saisit
     * son email et son mot de passe pour l'autoriser. Mêmes protections que la connexion
     * (blocage après plusieurs essais ratés). Le nouvel employé est connecté directement.
     */
    @Transactional
    public AuthResponse registerWithOwner(EmployeeRegisterRequest request) {
        String ownerEmail = normalize(request.ownerEmail());
        loginAttemptService.checkAllowed(ownerEmail);
        AppUser owner = userRepository.findByEmail(ownerEmail)
                .filter(u -> u.isActive() && u.getRole() == smartshop.entity.Role.OWNER
                        && passwordEncoder.matches(request.ownerPassword(), u.getPasswordHash()))
                .orElse(null);
        if (owner == null) {
            loginAttemptService.onFailure(ownerEmail);
            throw new IllegalArgumentException("Email ou mot de passe du propriétaire incorrect");
        }
        loginAttemptService.onSuccess(ownerEmail);

        String email = normalize(request.email());
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Un compte utilise déjà cet email");
        }
        AppUser user = new AppUser();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setActive(true);
        user.setShopId(owner.getShopId());
        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public UserResponse me(UUID userId) {
        return UserResponse.from(getUser(userId));
    }

    /** Change le mot de passe et déconnecte les autres appareils (anciens tokens refusés). */
    @Transactional
    public AuthResponse changePassword(UUID userId, ChangePasswordRequest request) {
        AppUser user = getUser(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Mot de passe actuel incorrect");
        }
        if (request.newPassword().equals(request.currentPassword())) {
            throw new IllegalArgumentException("Le nouveau mot de passe doit être différent de l'ancien");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        return toResponse(userRepository.save(user));
    }

    private AppUser getUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compte introuvable"));
    }

    private String normalize(String email) {
        return email.trim().toLowerCase();
    }

    private AuthResponse toResponse(AppUser user) {
        JwtService.IssuedToken issued = jwtService.issue(user);
        return new AuthResponse(issued.token(), issued.expiresAt(), user.getName(), user.getEmail(),
                user.getRole(), user.getRole().getPermissions());
    }
}