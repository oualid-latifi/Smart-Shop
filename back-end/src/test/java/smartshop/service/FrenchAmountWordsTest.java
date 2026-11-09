package smartshop.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class FrenchAmountWordsTest {

    @Test
    void spellsCommonNumbers() {
        assertThat(FrenchAmountWords.toWords(0)).isEqualTo("zéro");
        assertThat(FrenchAmountWords.toWords(21)).isEqualTo("vingt et un");
        assertThat(FrenchAmountWords.toWords(71)).isEqualTo("soixante et onze");
        assertThat(FrenchAmountWords.toWords(80)).isEqualTo("quatre-vingts");
        assertThat(FrenchAmountWords.toWords(81)).isEqualTo("quatre-vingt-un");
        assertThat(FrenchAmountWords.toWords(97)).isEqualTo("quatre-vingt-dix-sept");
        assertThat(FrenchAmountWords.toWords(200)).isEqualTo("deux cents");
        assertThat(FrenchAmountWords.toWords(1000)).isEqualTo("mille");
        assertThat(FrenchAmountWords.toWords(2_380_000)).isEqualTo("deux millions trois cent quatre-vingt mille");
    }

    @Test
    void spellsDirhamsAndCentimes() {
        assertThat(FrenchAmountWords.dirhams(new BigDecimal("1250.50")))
                .isEqualTo("mille deux cent cinquante dirhams et cinquante centimes");
        assertThat(FrenchAmountWords.dirhams(new BigDecimal("1.00"))).isEqualTo("un dirham");
    }
}
