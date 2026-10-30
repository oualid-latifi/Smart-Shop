import { Alert, Platform } from 'react-native';

export function confirmAction(
  message: string,
  onConfirm: () => void,
  cancelLabel: string,
  okLabel: string,
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('', message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onConfirm },
  ]);
}