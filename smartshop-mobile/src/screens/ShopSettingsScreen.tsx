import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ShopSettings } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { parseNumber } from '../format';
import { colors, radius, spacing } from '../theme';
import { useUnsavedChanges } from '../useUnsavedChanges';

type TextKey = Exclude<keyof ShopSettings, 'defaultVatRate' | 'quoteValidityDays' | 'maxDiscountPercent' | 'hasApprovalPin' | 'bigSaleAmount' | 'weeklyReportEnabled' | 'onlineShopEnabled'>;

/** Informations de la boutique imprimées sur les factures, devis, BL et tickets. */
export default function ShopSettingsScreen() {
  const { t } = useTranslation();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pin, setPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<number | null>(null);

  async function sendReport() {
    setError(null);
    setSentTo(null);
    setSending(true);
    try {
      const r = await api<{ recipients: number }>('/api/reports/weekly/send', { method: 'POST' });
      setSentTo(r.recipients);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSending(false);
    }
  }

  async function savePin() {
    setError(null);
    try {
      await api('/api/settings/approval-pin', { method: 'PUT', body: { pin } });
      setForm((f) => ({ ...(f ?? {}), hasApprovalPin: pin ? 'true' : 'false' }));
      setPin('');
      setPinSaved(true);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  useUnsavedChanges(dirty && !saving);

  useEffect(() => {
    api<ShopSettings>('/api/settings')
      .then((s) => {
        const values: Record<string, string> = {};
        Object.entries(s).forEach(([k, v]) => (values[k] = v == null ? '' : String(v)));
        setForm(values);
      })
      .catch((e) => setError(errorMessage(e, t)));
  }, [t]);

  function field(key: keyof ShopSettings, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) {
    return (
      <TextField
        label={label}
        value={form?.[key] ?? ''}
        onChangeText={(value) => {
          setForm((current) => ({ ...(current ?? {}), [key]: value }));
          setDirty(true);
          setSaved(false);
          setFieldErrors((current) => ({ ...current, [key]: '' }));
        }}
        error={fieldErrors[key] || null}
        {...extra}
      />
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const body: Partial<ShopSettings> = {
        defaultVatRate: parseNumber(form.defaultVatRate ?? '') ?? 20,
        quoteValidityDays: Math.round(parseNumber(form.quoteValidityDays ?? '') ?? 30),
        maxDiscountPercent: form.maxDiscountPercent?.trim() ? Math.round(parseNumber(form.maxDiscountPercent) ?? 0) : null,
        bigSaleAmount: form.bigSaleAmount?.trim() ? parseNumber(form.bigSaleAmount) : null,
        weeklyReportEnabled: form.weeklyReportEnabled === 'true',
        onlineShopEnabled: form.onlineShopEnabled === 'true',
      };
      const textKeys: TextKey[] = ['shopName', 'address', 'city', 'phone', 'email', 'ice', 'fiscalId', 'tradeRegister', 'patente', 'documentFooter', 'ticketFooter', 'reportEmails'];
      textKeys.forEach((k) => ((body as Record<string, unknown>)[k] = form[k]?.trim() || null));
      await api<ShopSettings>('/api/settings', { method: 'PUT', body });
      setDirty(false);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Screen>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.intro}>{t('shop.subtitle')}</Text>

      <Text style={styles.section}>{t('shop.identity')}</Text>
      {field('shopName', t('shop.shopName'))}
      {field('address', t('shop.address'))}
      {field('city', t('shop.city'))}
      {field('phone', t('shop.phone'), { keyboardType: 'phone-pad' })}
      {field('email', t('shop.email'), { keyboardType: 'email-address', autoCapitalize: 'none' })}

      <Text style={styles.section}>{t('shop.legal')}</Text>
      {field('ice', t('shop.ice'), { keyboardType: 'number-pad', maxLength: 15 })}
      {field('fiscalId', t('shop.fiscalId'))}
      {field('tradeRegister', t('shop.tradeRegister'))}
      {field('patente', t('shop.patente'))}

      <Text style={styles.section}>{t('shop.documents')}</Text>
      {field('defaultVatRate', t('shop.vat'), { keyboardType: 'decimal-pad' })}
      {field('quoteValidityDays', t('shop.quoteDays'), { keyboardType: 'number-pad' })}
      {field('documentFooter', t('shop.documentFooter'), { multiline: true })}
      {field('ticketFooter', t('shop.ticketFooter'))}

      <Text style={styles.section}>{t('approval.setTitle')}</Text>
      {field('maxDiscountPercent', t('approval.maxDiscount'), { keyboardType: 'number-pad', hint: t('approval.maxDiscountHint') })}
      <TextField
        label={`${t('approval.setTitle')} · ${form.hasApprovalPin === 'true' ? t('approval.defined') : t('approval.none')}`}
        hint={t('approval.setHint')}
        value={pin}
        onChangeText={(v) => setPin(v.replace(/[^\d]/g, '').slice(0, 8))}
        keyboardType="number-pad"
        secureTextEntry
      />
      <PrimaryButton icon="lock-closed-outline" title={t('approval.setTitle')} variant="outline" onPress={savePin} disabled={pin.length > 0 && pin.length < 4} />
      {pinSaved ? <Text style={styles.saved}>{t('approval.saved')}</Text> : null}

      <Text style={styles.section}>{t('online.title')}</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('shop.online')}</Text>
        <Switch
          accessibilityLabel={t('shop.online')}
          value={form.onlineShopEnabled === 'true'}
          onValueChange={(on) => {
            setForm((current) => ({ ...(current ?? {}), onlineShopEnabled: on ? 'true' : 'false' }));
            setDirty(true);
            setSaved(false);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <Text style={styles.section}>{t('shop.alerts')}</Text>
      {field('bigSaleAmount', t('shop.bigSale'), { keyboardType: 'decimal-pad', hint: t('shop.bigSaleHint') })}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('shop.weekly')}</Text>
        <Switch
          accessibilityLabel={t('shop.weekly')}
          value={form.weeklyReportEnabled === 'true'}
          onValueChange={(on) => {
            setForm((current) => ({ ...(current ?? {}), weeklyReportEnabled: on ? 'true' : 'false' }));
            setDirty(true);
            setSaved(false);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      {field('reportEmails', t('shop.reportEmails'), { keyboardType: 'email-address', autoCapitalize: 'none', hint: t('shop.reportEmailsHint') })}
      <PrimaryButton icon="mail-outline" title={t('shop.sendNow')} variant="outline" onPress={() => void sendReport()} loading={sending} />
      {sentTo !== null ? <Text style={styles.saved}>{t('shop.sent', { n: sentTo })}</Text> : null}
      <View style={{ height: spacing.md }} />

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {saved ? <Text style={styles.saved} accessibilityLiveRegion="polite">{t('shop.saved')}</Text> : null}
      <PrimaryButton icon="checkmark" title={t('products.save')} onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, marginBottom: spacing.sm },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.sm },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 48, marginBottom: spacing.sm },
  switchLabel: { flex: 1, color: colors.text, fontWeight: '600' },
  saved: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md, fontWeight: '700' },
});
