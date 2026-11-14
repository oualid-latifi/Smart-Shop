package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * Informations de la boutique imprimées sur les documents (une seule ligne, id = 1).
 * Au Maroc, l'ICE doit figurer sur les factures.
 */
@Entity
@Table(name = "shop_settings")
public class ShopSettings {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    @Column(name = "shop_name", length = 150)
    private String shopName;

    @Column(length = 255)
    private String address;

    @Column(length = 80)
    private String city;

    @Column(length = 30)
    private String phone;

    @Column(length = 150)
    private String email;

    // Identifiant Commun de l'Entreprise (15 chiffres)
    @Column(length = 20)
    private String ice;

    // Identifiant fiscal
    @Column(name = "fiscal_id", length = 30)
    private String fiscalId;

    // Registre de commerce
    @Column(name = "trade_register", length = 30)
    private String tradeRegister;

    @Column(length = 30)
    private String patente;

    // Taux de TVA appliqué aux produits sans taux propre (20 % par défaut au Maroc)
    @Column(name = "default_vat_rate", precision = 5, scale = 2)
    private BigDecimal defaultVatRate;

    // Durée de validité des devis, en jours
    @Column(name = "quote_validity_days")
    private Integer quoteValidityDays;

    @Column(name = "document_footer", length = 500)
    private String documentFooter;

    @Column(name = "ticket_footer", length = 255)
    private String ticketFooter;

    // Remise maximale (en %) qu'un employé peut accorder sans le code du propriétaire (null = pas de limite)
    @Column(name = "max_discount_percent")
    private Integer maxDiscountPercent;

    // Code PIN du propriétaire, haché (BCrypt)
    @Column(name = "approval_pin_hash", length = 100)
    private String approvalPinHash;

    public Long getId() { return id; }

    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getIce() { return ice; }
    public void setIce(String ice) { this.ice = ice; }

    public String getFiscalId() { return fiscalId; }
    public void setFiscalId(String fiscalId) { this.fiscalId = fiscalId; }

    public String getTradeRegister() { return tradeRegister; }
    public void setTradeRegister(String tradeRegister) { this.tradeRegister = tradeRegister; }

    public String getPatente() { return patente; }
    public void setPatente(String patente) { this.patente = patente; }

    public BigDecimal getDefaultVatRate() { return defaultVatRate != null ? defaultVatRate : BigDecimal.valueOf(20); }
    public void setDefaultVatRate(BigDecimal defaultVatRate) { this.defaultVatRate = defaultVatRate; }

    public int getQuoteValidityDays() { return quoteValidityDays != null ? quoteValidityDays : 30; }
    public void setQuoteValidityDays(Integer quoteValidityDays) { this.quoteValidityDays = quoteValidityDays; }

    public String getDocumentFooter() { return documentFooter; }
    public void setDocumentFooter(String documentFooter) { this.documentFooter = documentFooter; }

    public Integer getMaxDiscountPercent() { return maxDiscountPercent; }
    public void setMaxDiscountPercent(Integer maxDiscountPercent) { this.maxDiscountPercent = maxDiscountPercent; }

    public String getApprovalPinHash() { return approvalPinHash; }
    public void setApprovalPinHash(String approvalPinHash) { this.approvalPinHash = approvalPinHash; }

    public String getTicketFooter() { return ticketFooter; }
    public void setTicketFooter(String ticketFooter) { this.ticketFooter = ticketFooter; }
}
