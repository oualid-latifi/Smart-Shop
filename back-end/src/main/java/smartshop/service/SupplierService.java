package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Supplier;
import smartshop.repository.SupplierRepository;

import java.util.List;
import java.util.UUID;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    @Transactional
    public Supplier create(UUID id, String name, String phone) {
        Supplier supplier = new Supplier();
        supplier.setId(id);
        supplier.setName(name);
        supplier.setPhone(phone);
        return supplierRepository.save(supplier);
    }

    @Transactional
    public Supplier update(UUID id, String name, String phone) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fournisseur introuvable"));
        supplier.setName(name);
        supplier.setPhone(phone);
        return supplierRepository.save(supplier);
    }

    @Transactional(readOnly = true)
    public List<Supplier> findAll() {
        return supplierRepository.findAll();
    }
}
