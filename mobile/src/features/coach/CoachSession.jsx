import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen } from '../../components';
import { colors, font, spacing, tracking } from '../../theme';
import { cuesFor } from './pose/demo';

/**
 * En el celular (Expo Go / APK) todavía no hay análisis de postura: MediaPipe corre en el navegador.
 * Se explica y se muestran las indicaciones del ejercicio, para que la pantalla no quede en blanco.
 */
export function CoachSession({ exercise, rule }) {
  const router = useRouter();
  const cues = cuesFor(rule.id);
  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <Card>
        <View style={styles.icon}>
          <Ionicons name="desktop-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.title}>La cámara funciona en la versión web</Text>
        <Text style={styles.text}>
          El análisis de postura corre en el navegador. Abrí MacroEntreno en la compu o en el navegador del celular para que la cámara cuente tus
          repeticiones y te corrija la técnica.
        </Text>
      </Card>
      <Card title="Cómo se hace">
        <Text style={styles.text}>{rule.setup}</Text>
        <Text style={styles.text}>{cues.start}</Text>
        <Text style={styles.text}>{cues.peak}</Text>
        {exercise.tip ? <Text style={styles.text}>Tip: {exercise.tip}</Text> : null}
      </Card>
      <Button title="Volver" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700', letterSpacing: tracking.title },
  text: { color: colors.muted, fontSize: font.md, marginTop: spacing.xs },
});
