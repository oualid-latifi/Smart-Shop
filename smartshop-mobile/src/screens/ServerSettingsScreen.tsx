import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { API_URL } from '../config';
import { API_URL_KEY, storage } from '../storage';
import { colors, radius, spacing } from '../theme';

export default function ServerSettingsScreen() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || '').startsWith('ar');
  const [url, setUrl] = useState(API_URL);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    storage.get(API_URL_KEY).then((saved) => { if (active && saved) setUrl(saved); })
      .catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveAndTest() {
    let normalized = url.trim();
    while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    if (!(normalized.startsWith('http://') || normalized.startsWith('https://'))) {
      setSuccess(false);
      setMessage(isAr ? 'خاص العنوان يبدأ بـ http:// أو https://' : 'L’adresse doit commencer par http:// ou https://');
      return;
    }
    setTesting(true); setMessage('');
    try {
      await storage.set(API_URL_KEY, normalized);
      await api<{ accountExists: boolean }>('/api/auth/status', { auth: false });
      setSuccess(true); setMessage(isAr ? 'تم الاتصال بالخادم بنجاح.' : 'Connexion au serveur réussie.');
      setUrl(normalized);
    } catch {
      setSuccess(false);
      setMessage(isAr ? 'تعذر الاتصال. تحقق من IP الحاسوب وWi-Fi وتشغيل الخادم.' : 'Connexion impossible. Vérifiez l’IP du PC, le Wi-Fi et le démarrage du serveur.');
    } finally { setTesting(false); }
  }

  async function resetUrl() {
    setTesting(true); setMessage('');
    try {
      await storage.remove(API_URL_KEY); setUrl(API_URL);
      await api<{ accountExists: boolean }>('/api/auth/status', { auth: false });
      setSuccess(true); setMessage(isAr ? 'تمت استعادة العنوان الافتراضي والاتصال بنجاح.' : 'Adresse par défaut restaurée, connexion réussie.');
    } catch {
      setSuccess(false); setMessage(isAr ? 'تمت استعادة العنوان، لكن تعذر الاتصال بالخادم.' : 'Adresse par défaut restaurée, mais le serveur reste inaccessible.');
    } finally { setTesting(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <View style={styles.iconBox}><Ionicons name='server-outline' size={23} color={colors.primary} /></View>
          <View style={styles.flex}>
            <Text style={styles.title}>{isAr ? 'اتصال الحاسوب' : 'Connexion au PC'}</Text>
            <Text style={styles.subtitle}>{isAr ? 'عنوان الخادم المحلي عبر شبكة Wi-Fi' : 'Adresse du serveur local sur le réseau Wi-Fi'}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>{isAr ? 'عنوان الخادم (URL)' : 'Adresse du serveur (URL)'}</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : (
            <TextInput value={url} onChangeText={(value) => { setUrl(value); setMessage(''); }} autoCapitalize='none' autoCorrect={false} keyboardType='url' placeholder='http://192.168.1.47:8080' placeholderTextColor={colors.muted} style={styles.input} editable={!testing} textAlign='left' />
          )}
          <Text style={styles.hint}>{isAr ? 'فالحاسوب افتح CMD وكتب ipconfig. خذ IPv4 ديال Wi-Fi وزيد :8080.' : 'Sur le PC, ouvrez CMD puis ipconfig. Prenez l’adresse IPv4 du Wi-Fi et ajoutez :8080.'}</Text>
          <Pressable onPress={saveAndTest} disabled={loading || testing} style={({ pressed }) => [styles.primaryButton, (pressed || loading || testing) && styles.disabled]}>
            {testing ? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryText}>{isAr ? 'حفظ واختبار الاتصال' : 'Enregistrer et tester'}</Text>}
          </Pressable>
          <Pressable onPress={resetUrl} disabled={loading || testing} style={({ pressed }) => [styles.secondaryButton, (pressed || loading || testing) && styles.disabled]}>
            <Text style={styles.secondaryText}>{isAr ? 'استعادة العنوان الافتراضي' : 'Restaurer l’adresse par défaut'}</Text>
          </Pressable>
          {message ? <Text style={[styles.message, success ? styles.success : styles.error]}>{message}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius, padding: spacing.md, gap: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secondaryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  disabled: { opacity: 0.55 },
  message: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  success: { color: colors.success },
  error: { color: colors.danger },
});