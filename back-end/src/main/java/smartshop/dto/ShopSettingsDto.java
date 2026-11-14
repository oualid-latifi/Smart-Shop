package smartshop.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import smartshop.entity.ShopSettings;

import java.math.BigDecimal;

/** Sert à la fois de requête (PUT) et de réponse (GET) pour les paramètres de la boutique. */
public record ShopSettingsDto(
        @Size(max = 150) String shopName,
        @Size(max = 255) String address,
        @Size(max = 80) String city,
        @Size(max = 30) String phone,
        @Size(max = 150) String email,
        @Pattern(regexp = "^$|^\\d{15}$", message = "L'ICE contient 15 chiffres") String ice,
        @Size(max = 30) String fiscalId,
        @Size(max = 30) String tradeRegister,
        @Size(max = 30) String patente,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal defaultVatRate,
        @Min(1) @Max(365) Integer quoteValidityDays,
        @Size(max = 500) String documentFooter,
        @Size(max = 255) String ticketFooter,
        @Min(0) @Max(100) Integer maxDiscountPercent,
        Boolean hasApprovalPin            // lecture seule : un code PIN est-il défini ?
) {

    public static ShopSettingsDto from(ShopSettings s) {
        return new ShopSettingsDto(s.getShopName(), s.getAddress(), s.getCity(), s.getPhone(), s.getEmail(),
                s.getIce(), s.getFiscalId(), s.getTradeRegister(), s.getPatente(), s.getDefaultVatRate(),
                s.getQuoteValidityDays(), s.getDocumentFooter(), s.getTicketFooter(),
                s.getMaxDiscountPercent(), s.getApprovalPinHash() != null);
    }

    public void applyTo(ShopSettings s) {
        s.setShopName(blankToNull(shopName));
        s.setAddress(blankToNull(address));
        s.setCity(blankToNull(city));
        s.setPhone(blankToNull(phone));
        s.setEmail(blankToNull(email));
        s.setIce(blankToNull(ice));
        s.setFiscalId(blankToNull(fiscalId));
        s.setTradeRegister(blankToNull(tradeRegister));
        s.setPatente(blankToNull(patente));
        s.setDefaultVatRate(defaultVatRate);
        s.setQuoteValidityDays(quoteValidityDays);
        s.setDocumentFooter(blankToNull(documentFooter));
        s.setTicketFooter(blankToNull(ticketFooter));
        s.setMaxDiscountPercent(maxDiscountPercent);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
