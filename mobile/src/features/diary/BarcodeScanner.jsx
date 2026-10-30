import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextField } from '../../components';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'];
const isBarcode = (code) => /^\d{6,14}$/.test(code);

/**
 * Pantalla completa con la cámara para leer el código de barras del envase. Si la cámara no está
 * disponible (permiso denegado, navegador sin soporte) se puede escribir el número a mano.
 */
export function BarcodeScanner({ visible, onClose, onScanned }) {
  useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState(null);
  const handled = useRef(false);

  const finish = (code) => {
    if (handled.current) return;
    handled.current = true;
    onScanned(code);
  };

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (!isBarcode(code)) return setManualError('Son los 8 a 14 números que están debajo de las barras');
    finish(code);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onShow={() => {
        handled.current = false;
        setManual('');
        setManualError(null);
      }}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Escanear código</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar escáner" style={styles.close}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.cameraBox, continuous]}>
          {permission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={({ data }) => isBarcode(data) && finish(data)}
              />
              <View pointerEvents="none" style={styles.frame} />
            </>
          ) : (
            <View style={styles.permission}>
              <Ionicons name="barcode-outline" size={48} color={colors.muted} />
              <Text style={styles.permissionText}>
                {permission && !permission.canAskAgain
                  ? 'El permiso de cámara está bloqueado. Activalo en los ajustes o escribí el código abajo.'
                  : 'Apuntá la cámara al código de barras del envase.'}
              </Text>
              {!permission || permission.canAskAgain ? <Button title="Usar la cámara" icon="camera-outline" onPress={requestPermission} /> : null}
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          {Platform.OS === 'web' ? 'En la compu, el escaneo funciona mejor en Chrome o Edge. ' : ''}
          Buscamos el producto en tu catálogo y en Open Food Facts.
        </Text>

        <View style={styles.manual}>
          <TextField
            label="O escribí el código"
            placeholder="7790580660000"
            value={manual}
            onChangeText={(v) => {
              setManual(v);
              setManualError(null);
            }}
            error={manualError}
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={submitManual}
            style={{ flex: 1 }}
          />
          <Button title="Buscar" variant="secondary" onPress={submitManual} style={styles.manualButton} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = createStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  cameraBox: { flex: 1, maxHeight: 460, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '78%', height: 150, borderRadius: radius.md, borderWidth: 3, borderColor: colors.primary },
  permission: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  permissionText: { color: colors.muted, fontSize: font.md, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: font.sm, textAlign: 'center' },
  manual: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  manualButton: { marginBottom: 0 },
}));
