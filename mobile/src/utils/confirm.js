import { Alert, Platform } from 'react-native';

/** Diálogo de confirmación que también funciona en web. */
export function confirm(title, message, { confirmText = 'Eliminar', destructive = true } = {}) {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title, message) {
  if (Platform.OS === 'web') globalThis.alert?.(`${title}\n\n${message ?? ''}`);
  else Alert.alert(title, message);
}
