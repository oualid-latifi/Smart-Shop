package smartshop.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Montant en toutes lettres pour les factures :
 * 1250.50 -> "mille deux cent cinquante dirhams et cinquante centimes".
 */
public final class FrenchAmountWords {

    private static final String[] UNITS = {
            "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
            "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"};
    private static final String[] TENS = {
            "", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"};

    private FrenchAmountWords() {
    }

    public static String dirhams(BigDecimal amount) {
        BigDecimal rounded = amount.setScale(2, RoundingMode.HALF_UP).abs();
        long whole = rounded.longValue();
        int cents = rounded.subtract(BigDecimal.valueOf(whole)).movePointRight(2).intValue();

        StringBuilder text = new StringBuilder(toWords(whole)).append(whole > 1 ? " dirhams" : " dirham");
        if (cents > 0) {
            text.append(" et ").append(toWords(cents)).append(cents > 1 ? " centimes" : " centime");
        }
        return text.toString();
    }

    static String toWords(long n) {
        if (n < 0) return "moins " + toWords(-n);
        if (n < 1000) return belowThousand((int) n, true);

        StringBuilder out = new StringBuilder();
        long billions = n / 1_000_000_000;
        long millions = (n / 1_000_000) % 1000;
        long thousands = (n / 1000) % 1000;
        int rest = (int) (n % 1000);

        if (billions > 0) out.append(belowThousand((int) billions, false)).append(billions > 1 ? " milliards " : " milliard ");
        if (millions > 0) out.append(belowThousand((int) millions, false)).append(millions > 1 ? " millions " : " million ");
        if (thousands > 0) out.append(thousands == 1 ? "mille " : belowThousand((int) thousands, false) + " mille ");
        if (rest > 0) out.append(belowThousand(rest, true));
        return out.toString().trim();
    }

    // "final" : "quatre-vingts" et "deux cents" prennent un s seulement en fin de nombre
    private static String belowThousand(int n, boolean isFinal) {
        int hundreds = n / 100;
        int rest = n % 100;
        StringBuilder out = new StringBuilder();
        if (hundreds > 0) {
            out.append(hundreds == 1 ? "cent" : UNITS[hundreds] + " cent");
            if (hundreds > 1 && rest == 0 && isFinal) out.append('s');
            if (rest > 0) out.append(' ');
        }
        if (rest > 0 || hundreds == 0) out.append(belowHundred(rest, isFinal));
        return out.toString();
    }

    private static String belowHundred(int n, boolean isFinal) {
        if (n < 20) return UNITS[n];
        int tens = n / 10;
        int unit = n % 10;
        if (tens == 7 || tens == 9) {
            // 70-79 = soixante-dix…, 90-99 = quatre-vingt-dix…
            String base = TENS[tens];
            int remainder = 10 + unit;
            return base + (tens == 7 && unit == 1 ? " et " : "-") + UNITS[remainder];
        }
        if (unit == 0) return tens == 8 && isFinal ? "quatre-vingts" : TENS[tens];
        if (unit == 1 && tens != 8) return TENS[tens] + " et un";
        return TENS[tens] + "-" + UNITS[unit];
    }
}
