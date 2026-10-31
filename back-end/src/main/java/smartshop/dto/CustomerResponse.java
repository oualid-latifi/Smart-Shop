package smartshop.dto;

import smartshop.entity.Customer;

import java.math.BigDecimal;
import java.util.UUID;

public record CustomerResponse(
        UUID id,
        String name,
        String phone,
        BigDecimal creditLimit,
        BigDecimal balance,
        boolean active        // dette actuelle du client (kridi)
) {

    public static CustomerResponse from(Customer c, BigDecimal balance) {
        return new CustomerResponse(c.getId(), c.getName(), c.getPhone(), c.getCreditLimit(), balance, Boolean.TRUE.equals(c.getActive()));
    }
}
