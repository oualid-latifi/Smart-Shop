package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.AccountStatusResponse;
import smartshop.dto.AuthResponse;
import smartshop.dto.ChangePasswordRequest;
import smartshop.dto.LoginRequest;
import smartshop.dto.LogoutRequest;
import smartshop.dto.RefreshRequest;
import smartshop.dto.RegisterRequest;
import smartshop.dto.UpdateProfileRequest;
import smartshop.dto.UserResponse;
import smartshop.entity.AppUser;
import smartshop.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    public AuthController(AuthService authService) { this.authService = authService; }

    @GetMapping("/status")
    public AccountStatusResponse status() { return new AccountStatusResponse(authService.accountExists()); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) { return authService.register(request); }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) { return authService.login(request); }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) { return authService.refresh(request.refreshToken()); }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody LogoutRequest request) { authService.logout(request.refreshToken()); }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AppUser user) { return authService.me(user.getId()); }

    @PutMapping("/me")
    public UserResponse updateProfile(@AuthenticationPrincipal AppUser user,
            @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(user.getId(), request);
    }

    @PostMapping("/change-password")
    public AuthResponse changePassword(@AuthenticationPrincipal AppUser user,
            @Valid @RequestBody ChangePasswordRequest request) {
        return authService.changePassword(user.getId(), request);
    }
}