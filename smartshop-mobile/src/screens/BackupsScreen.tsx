import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { api, ApiError, getBaseUrl } from '../api/client';
import { errorMessage } from '../api/errors';
import type { BackupInfo } from '../api/types';
import PinPrompt from '../components/PinPrompt';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { Card } from '../components/ui';
import { confirmAction } from '../confirm';
import { shareDocument } from '../documents';
import { formatDateTime } from '../format';
import { storage, TOKEN_KEY } from '../storage';
import { colors, radius, spacing } from '../theme';

type Restore = { kind: 'server'; name: string } | { kind: 'file'; asset: DocumentPicker.DocumentPickerAsset };

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

/** Envoie un fichier de sauvegarde (multipart) : l'API JSON du client ne gère pas les fichiers. */
async function uploadRestore(asset: DocumentPicker.DocumentPickerAsset, pin: string | null) {
  const form = new FormData();
  if (Platform.OS === 'web' && asset.file) form.append('file', asset.file);
  else form.append('file', { uri: asset.uri, name: asset.name, type: 'application/zip' } as unknown as Blob);
  if (pin) form.append('pin', pin);
  const token = await storage.get(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${await getBaseUrl()}/api/backups/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.message ?? data?.detail ?? '', undefined, data?.code);
  }
}

/** Sauvegardes de toute la base : automatiques chaque nuit, manuelles, téléchargement et restauration. */
export default function BackupsScreen() {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState<Restore | null>(null);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api<BackupInfo[]>('/api/backups').then(setBackups).catch((e) => setError(errorMessage(e, t)));
  }, [t]);
  useFocusEffect(load);

  async function create() {
    setBusy('create');
    setError(null);
    setDone(null);
    try {
      const info = await api<BackupInfo>('/api/backups', { method: 'POST' });
      setDone(t('backups.created', { name: info.name }));
      load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  async function restore(target: Restore, pin: string | null) {
    setBusy('restore');
    setError(null);
    setDone(null);
    try {
      if (target.kind === 'server') {
        const query = pin ? `?pin=${encodeURIComponent(pin)}` : '';
        await api(`/api/backups/${encodeURIComponent(target.name)}/restore${query}`, { method: 'POST' });
      } else {
        await uploadRestore(target.asset, pin);
      }
      setPending(null);
      setPinMessage(null);
      setDone(t('backups.restored'));
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
        setPending(target);
        setPinMessage(e.message);
      } else {
        setPending(null);
        setPinMessage(null);
        setError(errorMessage(e, t));
      }
    } finally {
      setBusy(null);
    }
  }

  function askRestore(target: Restore) {
    confirmAction(t('backups.confirm'), () => void restore(target, null), t('common.cancel'), t('backups.restore'));
  }

  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    askRestore({ kind: 'file', asset: picked.assets[0] });
  }

  return (
    <Screen>
      <Card style={styles.intro}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
        <Text style={styles.introText}>{t('backups.help')}</Text>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton icon="save-outline" title={t('backups.create')} onPress={() => void create()} loading={busy === 'create'} disabled={!!busy} />
        <PrimaryButton icon="folder-open-outline" title={t('backups.fromFile')} variant="outline" onPress={() => void pickFile()} disabled={!!busy} />
      </View>

      {busy === 'restore' ? (
        <View style={styles.restoring}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{t('backups.restoring')}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={styles.done} accessibilityLiveRegion="polite">{done}</Text> : null}

      <Text style={styles.section}>{t('backups.list')}</Text>
      {backups === null && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {backups?.length === 0 ? <Text style={styles.empty}>{t('backups.empty')}</Text> : null}
      {backups?.map((b) => (
        <View key={b.name} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{formatDateTime(b.createdAt)}</Text>
            <Text style={styles.muted}>{size(b.size)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('backups.download')}
            hitSlop={8}
            style={styles.icon}
            onPress={() => shareDocument(`/api/backups/${b.name}`, b.name, t('docs.shareTitle'), 'application/zip').catch((e) => setError(errorMessage(e, t)))}
          >
            <Ionicons name="download-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('backups.restore')} hitSlop={8} style={styles.icon} disabled={!!busy} onPress={() => askRestore({ kind: 'server', name: b.name })}>
            <Ionicons name="refresh-outline" size={22} color={colors.warning} />
          </Pressable>
        </View>
      ))}

      <PinPrompt
        visible={!!pending && !!pinMessage}
        message={pinMessage}
        onCancel={() => { setPending(null); setPinMessage(null); }}
        onSubmit={(pin) => pending && void restore(pending, pin)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  introText: { flex: 1, color: colors.muted, fontSize: 13 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  restoring: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
  done: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
});
