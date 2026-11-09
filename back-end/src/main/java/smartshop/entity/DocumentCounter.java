package smartshop.entity;

import jakarta.persistence.*;

/** Compteur de numérotation par type de document et par année (ex : clé "FAC-2026"). */
@Entity
@Table(name = "document_counters")
public class DocumentCounter {

    @Id
    @Column(name = "counter_key", length = 20)
    private String key;

    @Column(name = "last_value", nullable = false)
    private Integer lastValue = 0;

    protected DocumentCounter() {
    }

    public DocumentCounter(String key) {
        this.key = key;
    }

    public String getKey() { return key; }

    public int next() {
        lastValue = lastValue + 1;
        return lastValue;
    }
}
