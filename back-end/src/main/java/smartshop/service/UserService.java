package smartshop.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.UserRequests.CreateUser;
import smartshop.dto.UserRequests.UpdateUser;
import smartshop.dto.UserResponse;
import smartshop.entity.AppUser;
import smartshop.entity.Role;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.AppUserRepository;
import smartshop.security.CurrentUser;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Comptes des employés, gérés par le propriétaire. */
@Service
public class UserService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing((AppUser u) -> u.getRole().ordinal()).thenComparing(AppUser::getName))
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(CreateUser request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Un compte utilise déjà cet email");
        }
        AppUser user = new AppUser();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setActive(true);
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUser request) {
        AppUser user = get(id);
        boolean self = CurrentUser.get().map(u -> u.getId().equals(id)).orElse(false);
        if (self && (request.role() != Role.OWNER || !request.active())) {
            throw new IllegalArgumentException("Tu ne peux pas retirer tes propres droits de propriétaire");
        }
        boolean wasActiveOwner = user.getRole() == Role.OWNER && user.isActive();
        boolean staysActiveOwner = request.role() == Role.OWNER && request.active();
        if (wasActiveOwner && !staysActiveOwner && countActiveOwners() <= 1) {
            throw new IllegalArgumentException("Il faut garder au moins un propriétaire actif");
        }
        user.setName(request.name().trim());
        user.setRole(request.role());
        if (user.isActive() != request.active()) {
            user.setActive(request.active());
            // Désactivation : les sessions ouvertes sont coupées immédiatement
            user.setTokenVersion(user.getTokenVersion() + 1);
        }
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse resetPassword(UUID id, String password) {
        AppUser user = get(id);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setTokenVersion(user.getTokenVersion() + 1);
        return UserResponse.from(userRepository.save(user));
    }

    private long countActiveOwners() {
        return userRepository.findAll().stream().filter(u -> u.getRole() == Role.OWNER && u.isActive()).count();
    }

    private AppUser get(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Compte introuvable"));
    }
}
