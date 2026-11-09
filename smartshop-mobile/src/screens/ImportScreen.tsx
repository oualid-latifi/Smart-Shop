import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ImportResult } from '../api/types';
import DocumentActions from '../components/DocumentActions';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { shareDocument } from '../documents';
import { colors, radius, spacing } from '../theme';

type Kind = 'products' | 'customers';

/** Import de produits / clients depuis un fichier CSV exporté d'Excel. */
export default function ImportScreen() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: Kind) {
    setError(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setBusy(kind);
    try {
      const csv = await new File(picked.assets[0].uri).text();
      setResult(await api<ImportResult>(`/api/import/${kind}`, { method: 'POST', body: { csv } }));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Text style={styles.help}>{t('import.help')}</Text>

      <View style={styles.actions}>
        <PrimaryButton icon="cube-outline" title={t('import.products')} onPress={() => void pick('products')} loading={busy === 'products'} disabled={!!busy} />
        <PrimaryButton icon="people-outline" title={t('import.customers')} onPress={() => void pick('customers')} loading={busy === 'customers'} disabled={!!busy} variant="outline" />
      </View>

      <DocumentActions
        onError={(e) => setError(errorMessage(e, t))}
        actions={(['products', 'customers'] as Kind[]).map((kind) => ({
          key: kind,
          label: t('import.template', { type: kind === 'products' ? t('tabs.products') : t('tabs.customers') }),
          icon: 'download-outline' as const,
          onPress: () => shareDocument(`/api/import/templates/${kind}.csv`, `modele-${kind}.csv`, t('docs.shareTitle')),
        }))}
      />

      {result ? (
        <View style={styles.result} accessibilityLiveRegion="polite">
          <Text style={styles.resultText}>{t('import.result', { created: result.created, updated: result.updated })}</Text>
          {result.errors.length > 0 ? (
            <>
              <Text style={styles.errorsTitle}>{t('import.errors')} ({result.errors.length})</Text>
              {result.errors.slice(0, 50).map((e) => (
                <Text key={e.line} style={styles.errorLine}>{t('import.line', { n: e.line })} : {e.message}</Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  actions: { gap: spacing.sm, marginBottom: spacing.md },
  result: { marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  resultText: { color: colors.success, fontWeight: '800', fontSize: 16 },
  errorsTitle: { color: colors.danger, fontWeight: '700', marginTop: spacing.sm },
  errorLine: { color: colors.text, fontSize: 13 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
