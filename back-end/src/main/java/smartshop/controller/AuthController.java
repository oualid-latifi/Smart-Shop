package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.AccountStatusResponse;
import smartshop.dto.AuthResponse;
import smartshop.dto.ChangePasswordRequest;
import smartshop.dto.LoginRequest;\nimport smartshop.dto.RefreshRequest;\nimport smartshop.dto.LogoutRequest;
import smartshop.dto.RegisterRequest;
import smartshop.dto.UserResponse;
import smartshop.entity.AppUser;
import smartshop.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // Public : l'application sait s'il faut afficher "créer le compte" ou "se connecter"
    @GetMapping("/status")
    public AccountStatusResponse status() {
        return new AccountStatusResponse(authService.accountExists());
    }

    // Public, mais refusé dès qu'un compte existe
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")\n    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {\n        return authService.refresh(request.refreshToken());\n    }\n\n    @PostMapping("/logout")\n    @ResponseStatus(HttpStatus.NO_CONTENT)\n    public void logout(@Valid @RequestBody LogoutRequest request) {\n        authService.logout(request.refreshToken());\n    }\n\n    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AppUser user) {
        return authService.me(user.getId());
    }

    @PostMapping("/change-password")
    public AuthResponse changePassword(@AuthenticationPrincipal AppUser user,
                                       @Valid @RequestBody ChangePasswordRequest request) {
        return authService.changePassword(user.getId(), request);
    }
}