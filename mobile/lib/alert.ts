import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog that works reliably across both
 * React Native (iOS/Android) and React Native Web.
 *
 * React Native Web's Alert.alert() polyfill only displays a basic alert()
 * and silently drops button callbacks. This helper transparently uses
 * window.confirm() on Web so action callbacks are properly executed.
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'OK',
  cancelText = 'Cancel'
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        onConfirm();
      }
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }
  Alert.alert(title, message, [{ text: 'OK' }]);
}

