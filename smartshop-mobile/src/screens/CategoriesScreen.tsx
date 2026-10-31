import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Category } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { colors, radius, spacing } from '../theme';

export default function CategoriesScreen() {
  const { t, i18n } = useTranslation();
  const ar = (i18n.language || '').startsWith('ar');
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setItems(await api<Category[]>('/api/categories'));
    } catch (e) {
      setLoadError(true);
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    const clean = name.trim();
    if (!clean) { setError(ar ? 'اكتب اسم الفئة' : 'Saisis le nom de la catégorie'); return; }
    setBusy(true); setError('');
    try {
      await api(editing ? `/api/categories/${editing}` : '/api/categories', {
        method: editing ? 'PUT' : 'POST', body: { name: clean },
      });
      setName(''); setEditing(null); await load();
    } catch (e) { setError(errorMessage(e, t)); }
    finally { setBusy(false); }
  }

  function remove(item: Category) {
    Alert.alert(
      ar ? 'حذف الفئة' : 'Supprimer la catégorie',
      ar ? 'لا يمكن حذف فئة مرتبطة بمنتجات.' : 'Une catégorie utilisée par des produits ne peut pas être supprimée.',
      [{ text: t('common.cancel'), style: 'cancel' }, {
        text: t('common.confirm'), style: 'destructive', onPress: async () => {
          setError('');
          try { await api(`/api/categories/${item.id}`, { method: 'DELETE' }); await load(); }
          catch (e) { setError(errorMessage(e, t)); }
        },
      }],
    );
  }

  return (
    <Screen>
      <Text style={styles.heading}>{ar ? 'إدارة الفئات' : 'Gestion des catégories'}</Text>
      <Text style={styles.subtitle}>{ar ? 'نظّم منتجات متجرك حسب الفئات' : 'Organise les produits de ta boutique'}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={ar ? 'اسم الفئة' : 'Nom de la catégorie'}
        placeholderTextColor={colors.muted} style={styles.input} maxLength={100} />
      <PrimaryButton title={editing ? (ar ? 'حفظ التعديل' : 'Enregistrer') : (ar ? 'إضافة فئة' : 'Ajouter une catégorie')}
        onPress={() => void save()} loading={busy} />
      {editing ? <View style={styles.cancel}><PrimaryButton title={t('common.cancel')} onPress={() => { setEditing(null); setName(''); }} variant="outline" /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loadError ? <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" /> : null}
      <FlatList data={items} keyExtractor={x => x.id} style={styles.list}
        ListEmptyComponent={!loadError ? <Text style={styles.empty}>{ar ? 'لا توجد فئات بعد' : 'Aucune catégorie pour le moment'}</Text> : undefined}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Pressable onPress={() => { setEditing(item.id); setName(item.name); }} style={styles.action}>
              <Ionicons name="create-outline" size={21} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => remove(item)} style={styles.action}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: spacing.lg },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, padding: spacing.md, color: colors.text, marginBottom: spacing.md },
  cancel: { marginTop: spacing.sm },
  list: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemName: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 },
  action: { padding: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.md },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
