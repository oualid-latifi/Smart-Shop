import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Product } from '../api/types';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';
import { Badge, ProductThumb } from './ui';

/** Choix de la variante (couleur, capacité) d'un produit avant de l'ajouter au panier. */
export default function VariantPicker({ variants, onPick, onClose }: { variants: Product[] | null; onPick: (p: Product) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const title = variants?.[0]?.variantGroup ?? variants?.[0]?.name ?? '';

  return (
    <Modal visible={!!variants} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('scanner.close')} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={styles.list}>
          {(variants ?? []).map((p) => {
            const unavailable = p.stockQuantity <= 0;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: unavailable }}
                disabled={unavailable}
                onPress={() => onPick(p)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed, unavailable && styles.off]}
              >
                <ProductThumb uri={p.imageUrl} size={44} />
                <View style={styles.flex}>
                  <Text style={styles.name}>{[p.capacity, p.color].filter(Boolean).join(' · ') || p.reference}</Text>
                  <Text style={styles.muted}>{p.reference}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.price}>{formatMoney(p.promoPrice ?? p.salePrice)}</Text>
                  <Badge label={unavailable ? t('sales.outOfStock') : t('sales.inStock', { n: p.stockQuantity })} tone={unavailable ? 'danger' : 'success'} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,8,20,0.6)' },
  sheet: { maxHeight: '75%', backgroundColor: colors.card, borderTopLeftRadius: radius + 10, borderTopRightRadius: radius + 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius, backgroundColor: colors.cardAlt, marginBottom: spacing.sm, minHeight: 60 },
  pressed: { opacity: 0.7 },
  off: { opacity: 0.45 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  name: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  price: { color: colors.text, fontWeight: '800' },
});
