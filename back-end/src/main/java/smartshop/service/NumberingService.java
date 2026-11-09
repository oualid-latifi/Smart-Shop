package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.DocumentCounter;
import smartshop.entity.DocumentType;
import smartshop.repository.DocumentCounterRepository;

import java.time.Year;

/**
 * Numérotation continue des documents, remise à zéro chaque année :
 * FAC-2026-00001, FAC-2026-00002… (exigence légale : pas de trou ni de doublon pour les factures).
 */
@Service
public class NumberingService {

    private final DocumentCounterRepository counterRepository;

    public NumberingService(DocumentCounterRepository counterRepository) {
        this.counterRepository = counterRepository;
    }

    // S'exécute dans la transaction de l'appelant : si la vente échoue, le numéro n'est pas consommé
    @Transactional(propagation = Propagation.MANDATORY)
    public String next(DocumentType type) {
        int year = Year.now().getValue();
        String key = type.getPrefix() + "-" + year;
        DocumentCounter counter = counterRepository.findForUpdate(key)
                .orElseGet(() -> counterRepository.saveAndFlush(new DocumentCounter(key)));
        int value = counter.next();
        counterRepository.save(counter);
        return String.format("%s-%05d", key, value);
    }
}
