package smartshop.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import smartshop.dto.ReportSummaryResponse;
import smartshop.entity.AppUser;
import smartshop.entity.Role;
import smartshop.entity.ShopSettings;
import smartshop.repository.AppUserRepository;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Rapport de la semaine écoulée, envoyé chaque lundi matin par email au(x) propriétaire(s)
 * avec le rapport Excel détaillé en pièce jointe. Le même résumé texte peut être partagé
 * sur WhatsApp depuis l'application.
 * L'email ne part que si un serveur SMTP est configuré (variables SPRING_MAIL_*).
 */
@Service
public class WeeklyReportService {

    private static final Logger log = LoggerFactory.getLogger(WeeklyReportService.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record Weekly(LocalDate from, LocalDate to, String subject, String text) {
    }

    private final ReportService reportService;
    private final ExcelReportService excelReportService;
    private final ShopSettingsService settingsService;
    private final AppUserRepository userRepository;
    private final ObjectProvider<JavaMailSender> mailSender;
    private final String mailFrom;

    public WeeklyReportService(ReportService reportService, ExcelReportService excelReportService,
                               ShopSettingsService settingsService, AppUserRepository userRepository,
                               ObjectProvider<JavaMailSender> mailSender,
                               @Value("${app.mail.from:}") String mailFrom) {
        this.reportService = reportService;
        this.excelReportService = excelReportService;
        this.settingsService = settingsService;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
        this.mailFrom = mailFrom;
    }

    /** Semaine précédente : du lundi au dimanche. */
    public Weekly lastWeek() {
        LocalDate lastMonday = LocalDate.now().with(TemporalAdjusters.previous(DayOfWeek.MONDAY));
        if (LocalDate.now().getDayOfWeek() != DayOfWeek.MONDAY) lastMonday = lastMonday.minusWeeks(1);
        return build(lastMonday, lastMonday.plusDays(6));
    }

    public Weekly build(LocalDate from, LocalDate to) {
        ReportSummaryResponse r = reportService.summary(from, to);
        ShopSettings settings = settingsService.get();
        String shop = settings.getShopName() != null ? settings.getShopName() : "SmartShop";
        StringBuilder text = new StringBuilder();
        text.append("📊 ").append(shop).append(" — semaine du ").append(DATE.format(from)).append(" au ").append(DATE.format(to)).append("\n\n");
        text.append("🛒 Ventes : ").append(r.salesCount()).append("\n");
        text.append("💰 Chiffre d'affaires : ").append(money(r.revenue())).append("\n");
        text.append("📈 Marge brute : ").append(money(r.grossProfit())).append("\n");
        text.append("🧾 Dépenses : ").append(money(r.expenses())).append("\n");
        text.append("✅ Bénéfice net : ").append(money(r.netProfit())).append("\n");
        text.append("💵 Encaissé : ").append(money(r.cashCollected())).append("\n\n");
        text.append("À ce jour :\n");
        text.append("• Crédit clients : ").append(money(r.totalCustomerDebt())).append("\n");
        text.append("• Dettes fournisseurs : ").append(money(r.totalSupplierDebt())).append("\n");
        text.append("• Valeur du stock : ").append(money(r.stockValue())).append("\n");
        text.append("• Produits en stock bas : ").append(r.lowStockCount()).append("\n");
        if (!r.topProducts().isEmpty()) {
            text.append("\nMeilleures ventes :\n");
            r.topProducts().forEach(p -> text.append("• ").append(p.name()).append(" ×").append(p.quantitySold()).append("\n"));
        }
        return new Weekly(from, to, shop + " — rapport de la semaine du " + DATE.format(from), text.toString());
    }

    // Chaque lundi à 8 h (heure du Maroc)
    @Scheduled(cron = "${app.report.weekly-cron:0 0 8 * * MON}")
    public void sendWeekly() {
        if (!Boolean.TRUE.equals(settingsService.get().getWeeklyReportEnabled())) return;
        try {
            int sent = send(lastWeek());
            log.info("Rapport hebdomadaire envoyé à {} destinataire(s)", sent);
        } catch (Exception e) {
            log.error("Rapport hebdomadaire non envoyé", e);
        }
    }

    /** Envoie le rapport (avec l'Excel en pièce jointe). Renvoie le nombre de destinataires. */
    public int send(Weekly weekly) throws Exception {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            throw new IllegalArgumentException("Aucun serveur email configuré (variables SPRING_MAIL_HOST, SPRING_MAIL_USERNAME, SPRING_MAIL_PASSWORD)");
        }
        List<String> to = recipients();
        if (to.isEmpty()) throw new IllegalArgumentException("Aucun destinataire : renseigne les emails du rapport dans Ma boutique");

        MimeMessage message = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        if (!mailFrom.isBlank()) helper.setFrom(mailFrom);
        helper.setTo(to.toArray(String[]::new));
        helper.setSubject(weekly.subject());
        helper.setText(weekly.text());
        byte[] excel = excelReportService.build(weekly.from(), weekly.to());
        helper.addAttachment("rapport-" + weekly.from() + "-au-" + weekly.to() + ".xlsx", new ByteArrayResource(excel));
        sender.send(message);
        return to.size();
    }

    /** Emails saisis dans Ma boutique, sinon ceux des comptes propriétaires actifs. */
    private List<String> recipients() {
        String configured = settingsService.get().getReportEmails();
        if (configured != null && !configured.isBlank()) {
            return Arrays.stream(configured.split("[,;\\s]+")).map(String::trim).filter(s -> s.contains("@")).toList();
        }
        List<String> owners = new ArrayList<>();
        for (AppUser u : userRepository.findAll()) if (u.isActive() && u.getRole() == Role.OWNER) owners.add(u.getEmail());
        return owners;
    }

    private static String money(java.math.BigDecimal value) {
        return DocumentPdfService.money(value) + " DH";
    }
}
