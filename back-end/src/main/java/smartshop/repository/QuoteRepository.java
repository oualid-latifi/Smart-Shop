package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Quote;

import java.util.List;
import java.util.UUID;

public interface QuoteRepository extends JpaRepository<Quote, UUID> {

    List<Quote> findAllByOrderByCreatedAtDesc();
}
