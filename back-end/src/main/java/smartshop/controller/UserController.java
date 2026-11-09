package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.UserRequests.CreateUser;
import smartshop.dto.UserRequests.ResetPassword;
import smartshop.dto.UserRequests.UpdateUser;
import smartshop.dto.UserResponse;
import smartshop.service.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserResponse> findAll() {
        return userService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUser request) {
        return userService.create(request);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateUser request) {
        return userService.update(id, request);
    }

    @PostMapping("/{id}/password")
    public UserResponse resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPassword request) {
        return userService.resetPassword(id, request.password());
    }
}
