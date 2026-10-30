package smartshop.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.AuthResponse;
import smartshop.dto.ChangePasswordRequest;
import smartshop.dto.LoginRequest;
import smartshop.dto.RegisterRequest;
import smartshop.dto.UserResponse;
import smartshop.entity.AppUser;
import smartshop.exception.InvalidCredentialsException;
import smartshop.repository.AppUserRepository;
import smartshop.security.JwtService;

import java.util.UUID;

@Service
public class AuthService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(AppUserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public boolean accountExists() {
        return userRepository.count() > 0;
    }

    /** Création du compte du propriétaire : possible une seule fois. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.count() > 0) {
            throw new IllegalArgumentException("Un compte existe déjà : utilise la connexion");
        }
        AppUser user = new AppUser();
        user.setName(request.name().trim());
        user.setEmail(normalize(request.email()));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        // Même message d'erreur si l'email n'existe pas ou si le mot de passe est faux
        AppUser user = userRepository.findByEmail(normalize(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(InvalidCredentialsException::new);
        return toResponse(user);
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
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable"));
    }

    private String normalize(String email) {
        return email.trim().toLowerCase();
    }

    private AuthResponse toResponse(AppUser user) {
        JwtService.IssuedToken issued = jwtService.issue(user);
        return new AuthResponse(issued.token(), issued.expiresAt(), user.getName(), user.getEmail());
    }
}