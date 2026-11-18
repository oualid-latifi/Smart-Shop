package smartshop.tenancy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import smartshop.entity.Shop;
import smartshop.repository.ShopRepository;
import smartshop.service.BackupService;
import smartshop.service.NotificationService;
import smartshop.service.WeeklyReportService;

import java.util.function.Consumer;

/** Tâches planifiées (heure du Maroc), lancées pour chaque boutique l'une après l'autre. */
@Component
public class TenantJobs {

    private static final Logger log = LoggerFactory.getLogger(TenantJobs.class);

    private final ShopRepository shopRepository;
    private final BackupService backupService;
    private final NotificationService notificationService;
    private final WeeklyReportService weeklyReportService;

    public TenantJobs(ShopRepository shopRepository, BackupService backupService,
                      NotificationService notificationService, WeeklyReportService weeklyReportService) {
        this.shopRepository = shopRepository;
        this.backupService = backupService;
        this.notificationService = notificationService;
        this.weeklyReportService = weeklyReportService;
    }

    // Sauvegarde de chaque boutique, chaque nuit (désactivable avec BACKUP_CRON=-)
    @Scheduled(cron = "${app.backup.cron:0 30 2 * * *}")
    public void nightlyBackups() {
        forEachShop("sauvegarde", shop -> backupService.nightly());
    }

    @Scheduled(cron = "${app.notifications.checks-cron:0 0 8 * * *}")
    public void checksDueSoon() {
        forEachShop("chèques à encaisser", shop -> notificationService.checksDueSoon());
    }

    @Scheduled(cron = "${app.report.weekly-cron:0 0 8 * * MON}")
    public void weeklyReports() {
        forEachShop("rapport hebdomadaire", shop -> weeklyReportService.sendWeekly());
    }

    private void forEachShop(String job, Consumer<Shop> task) {
        for (Shop shop : shopRepository.findByActiveTrue()) {
            try {
                TenantContext.runAs(shop.getId(), () -> task.accept(shop));
            } catch (RuntimeException e) {
                // Une boutique en erreur n'empêche pas les autres
                log.error("Tâche « {} » en échec pour la boutique {}", job, shop.getSlug(), e);
            }
        }
    }
}
