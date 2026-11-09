import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../theme';
import PrimaryButton from './PrimaryButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

/** Plein écran caméra : renvoie le premier code-barres lu (EAN, UPC, Code 128, QR…). */
export default function BarcodeScanner({ visible, onClose, onScanned }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  // La caméra peut lire le même code plusieurs fois par seconde : on ne garde que la première lecture
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => { handled.current = false; }}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current || !data) return;
              handled.current = true;
              onScanned(data.trim());
            }}
          />
        ) : (
          <View style={styles.permission}>
            <Ionicons name="camera-outline" size={48} color={colors.onPrimary} />
            <Text style={styles.permissionText}>{t('scanner.permission')}</Text>
            <PrimaryButton title={t('scanner.allow')} onPress={() => void requestPermission()} />
          </View>
        )}

        {/* Cadre de visée */}
        {permission?.granted ? <View pointerEvents="none" style={styles.frame} /> : null}

        <View style={styles.top}>
          <Text style={styles.title}>{t('scanner.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('scanner.close')} onPress={onClose} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 48, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', top: '35%', left: '10%', right: '10%', height: 160, borderWidth: 3, borderColor: '#fff', borderRadius: radius + 4 },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 15 },
});
