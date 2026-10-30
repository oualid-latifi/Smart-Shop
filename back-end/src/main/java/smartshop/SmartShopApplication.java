package smartshop;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class SmartShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartShopApplication.class, args);
    }

    // Les rapports "du jour" suivent l'heure du Maroc
    @PostConstruct
    void setTimezone() {
        TimeZone.setDefault(TimeZone.getTimeZone("Africa/Casablanca"));
    }
}
