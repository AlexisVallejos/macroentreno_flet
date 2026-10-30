import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';

/** Errores que se arreglan configurando el servidor (no reintentando): se muestra este panel. */
export const SETUP_CODES = ['AI_NOT_CONFIGURED', 'AI_INVALID_KEY'];

const STEPS = [
  { text: 'Abrí el archivo', code: 'backend/.env' },
  { text: 'Pegá tu clave de OpenAI (empieza con sk-) en la línea', code: 'OPENAI_API_KEY=sk-...' },
  { text: 'Reiniciá la API', code: 'cd backend && npm run dev' },
];

/**
 * Estado vacío cuando el asistente no puede funcionar por falta de clave (o clave inválida).
 * Explica exactamente dónde va la clave; el administrador ve los pasos, el resto también pero con
 * el aviso de que lo tiene que hacer quien maneja el servidor.
 */
export function AssistantSetup({ reason = 'AI_NOT_CONFIGURED', isAdmin, onRecheck, checking }) {
  useTheme();
  const invalid = reason === 'AI_INVALID_KEY';
  return (
    <View style={styles.root} accessibilityRole="summary">
      <View style={[styles.icon, continuous]}>
        <Ionicons name={invalid ? 'alert-circle-outline' : 'key-outline'} size={30} color={colors.warning} />
      </View>
      <Text style={styles.title}>{invalid ? 'La clave de OpenAI es inválida' : 'Falta configurar el asistente'}</Text>
      <Text style={styles.text}>
        {invalid
          ? 'OpenAI rechazó la clave cargada en el servidor. Puede estar mal copiada, vencida o revocada.'
          : 'El asistente con IA necesita una clave de OpenAI en el servidor. La clave nunca se guarda en la app.'}
        {isAdmin ? '' : ' Pasale estos pasos a quien administra el servidor:'}
      </Text>

      <View style={[styles.card, continuous]}>
        {STEPS.map((step, i) => (
          <View key={step.code} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.stepText}>{step.text}</Text>
              <Text style={[styles.code, continuous]} selectable>
                {step.code}
              </Text>
            </View>
          </View>
        ))}
        <Text style={styles.hint}>
          Las claves se crean en platform.openai.com/api-keys y la cuenta necesita saldo cargado. Al arrancar, la API avisa en la consola si el asistente quedó activo.
        </Text>
      </View>

      {onRecheck ? <Button title="Ya la configuré, volver a probar" icon="refresh" variant="tinted" onPress={onRecheck} loading={checking} /> : null}
    </View>
  );
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const styles = createStyles(() => StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  icon: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700', textAlign: 'center' },
  text: { color: colors.muted, fontSize: font.md, textAlign: 'center', maxWidth: 440, lineHeight: 21 },
  card: { alignSelf: 'stretch', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  stepText: { color: colors.text, fontSize: font.md },
  code: { fontFamily: mono, color: colors.text, fontSize: font.sm, backgroundColor: colors.fill, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, overflow: 'hidden' },
  hint: { color: colors.muted, fontSize: font.sm, lineHeight: 19 },
}));
