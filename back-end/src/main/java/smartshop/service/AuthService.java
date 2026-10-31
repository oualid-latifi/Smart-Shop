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
    private final RefreshTokenService refreshTokenService;

    public AuthService(AppUserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional(readOnly = true)
    public boolean accountExists() { return userRepository.count() > 0; }

    /** Création du compte unique du propriétaire. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.count() > 0)
            throw new IllegalArgumentException("Un compte existe déjà : utilise la connexion");
        AppUser user = new AppUser();
        user.setName(request.name().trim());
        user.setEmail(normalize(request.email()));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        AppUser user = userRepository.findByEmail(normalize(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(InvalidCredentialsException::new);
        return toResponse(user);
    }

    public AuthResponse refresh(String rawRefreshToken) {
        var rotated = refreshTokenService.rotate(rawRefreshToken);
        AppUser user = userRepository.findById(rotated.userId())
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable"));
        JwtService.IssuedToken access = jwtService.issue(user);
        return new AuthResponse(access.token(), access.expiresAt(), rotated.token(),
                rotated.expiresAt(), user.getName(), user.getEmail());
    }

    @Transactional
    public void logout(String rawRefreshToken) { refreshTokenService.revoke(rawRefreshToken); }

    @Transactional(readOnly = true)
    public UserResponse me(UUID userId) { return UserResponse.from(getUser(userId)); }

    @Transactional
    public AuthResponse changePassword(UUID userId, ChangePasswordRequest request) {
        AppUser user = getUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash()))
            throw new IllegalArgumentException("Mot de passe actuel incorrect");
        if (request.newPassword().equals(request.currentPassword()))
            throw new IllegalArgumentException("Le nouveau mot de passe doit être différent de l'ancien");
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        refreshTokenService.revokeAll(userId);
        return toResponse(userRepository.save(user));
    }

    private AppUser getUser(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Compte introuvable"));
    }
    private String normalize(String email) { return email.trim().toLowerCase(); }

    private AuthResponse toResponse(AppUser user) {
        JwtService.IssuedToken access = jwtService.issue(user);
        var refresh = refreshTokenService.create(user);
        return new AuthResponse(access.token(), access.expiresAt(), refresh.token(),
                refresh.expiresAt(), user.getName(), user.getEmail());
    }
}