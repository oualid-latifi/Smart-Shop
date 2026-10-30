package smartshop.dto;

import smartshop.entity.Supplier;

import java.util.UUID;

public record SupplierResponse(UUID id, String name, String phone) {

    public static SupplierResponse from(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getPhone());
    }
}
