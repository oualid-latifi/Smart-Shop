package smartshop.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import smartshop.entity.Sale;
import smartshop.entity.ShopSettings;
import smartshop.service.SaleService;
import smartshop.service.ShopSettingsService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Page publique ouverte en scannant le QR code d'une facture : confirme qu'elle a bien été émise
 * par la boutique, avec son numéro, sa date et son montant (le nom du client est masqué).
 */
@RestController
public class VerifyController {

    private final SaleService saleService;
    private final ShopSettingsService settingsService;

    public VerifyController(SaleService saleService, ShopSettingsService settingsService) {
        this.saleService = saleService;
        this.settingsService = settingsService;
    }

    @GetMapping(value = "/verify/{code}", produces = MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
    public String verify(@PathVariable String code) {
        ShopSettings settings = settingsService.get();
        String shop = escape(settings.getShopName() != null ? settings.getShopName() : "SmartShop");
        Optional<Sale> found = code.matches("[A-Z0-9]{20}") ? saleService.findByVerificationCode(code) : Optional.empty();

        String body;
        if (found.isEmpty()) {
            body = "<div class='badge ko'>✕ Facture introuvable</div>"
                    + "<p>Ce code ne correspond à aucune facture émise par " + shop + ".</p>";
        } else {
            Sale sale = found.get();
            boolean cancelled = sale.getStatus() == smartshop.entity.SaleStatus.CANCELLED;
            body = (cancelled ? "<div class='badge ko'>Facture annulée</div>" : "<div class='badge ok'>✓ Facture authentique</div>")
                    + "<table>"
                    + row("Émise par", shop + (settings.getIce() != null ? "<br><small>ICE " + escape(settings.getIce()) + "</small>" : ""))
                    + row("Facture N°", escape(sale.getInvoiceNumber()))
                    + row("Date", DateTimeFormatter.ofPattern("dd/MM/yyyy").format(sale.getInvoiceDate()))
                    + row("Client", mask(sale.getCustomer() != null ? sale.getCustomer().getName() : "Client de passage"))
                    + row("Montant TTC", money(sale.getTotal()) + " DH")
                    + "</table>";
        }
        return "<!doctype html><html lang='fr'><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'><title>Vérification de facture</title>"
                + "<style>body{margin:0;font-family:system-ui,sans-serif;background:#0a1224;color:#eef3ff;display:flex;justify-content:center;padding:24px}"
                + ".card{max-width:420px;width:100%;background:#111c33;border:1px solid #1f2c4a;border-radius:18px;padding:24px}"
                + "h1{font-size:18px;margin:0 0 16px}.badge{display:inline-block;padding:8px 14px;border-radius:999px;font-weight:800;margin-bottom:16px}"
                + ".ok{background:#0f2e22;color:#2fd07a}.ko{background:#3a1622;color:#ff5b6b}"
                + "table{width:100%;border-collapse:collapse}td{padding:10px 0;border-bottom:1px solid #1f2c4a;vertical-align:top}"
                + "td:first-child{color:#8c9cbd}td:last-child{text-align:right;font-weight:700}small{color:#8c9cbd;font-weight:400}</style></head>"
                + "<body><div class='card'><h1>Vérification de facture</h1>" + body + "</div></body></html>";
    }

    private static String row(String label, String value) {
        return "<tr><td>" + label + "</td><td>" + value + "</td></tr>";
    }

    /** "Société Nour SARL" -> "S****** N*** S***" : on confirme sans exposer le client. */
    private static String mask(String name) {
        StringBuilder out = new StringBuilder();
        for (String word : name.trim().split("\\s+")) {
            if (word.isEmpty()) continue;
            if (!out.isEmpty()) out.append(' ');
            out.append(word.charAt(0)).append("*".repeat(Math.max(1, word.length() - 1)));
        }
        return escape(out.toString());
    }

    private static String money(BigDecimal value) {
        return String.format(java.util.Locale.FRANCE, "%,.2f", value.setScale(2, RoundingMode.HALF_UP)).replace(' ', ' ').replace(' ', ' ');
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
