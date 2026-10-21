import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, continuous, font, numeric, radius, spacing } from '../theme';
import { fmt } from '../utils/format';

/** Color de la barra: las metas se ponen verdes al cumplirse; los límites, naranja cerca y rojo pasados. */
function barColor(n) {
  if (n.kind === 'limit') return n.percent > 100 ? colors.danger : n.percent >= 80 ? colors.warning : colors.secondary;
  return n.percent >= 100 ? colors.primary : 'rgba(48,209,88,0.55)';
}

/**
 * Micronutrientes contra el valor diario de referencia, al estilo de la app Salud.
 * `nutrients` viene de la API (resumen del día o promedio del período).
 */
export function MicroList({ nutrients, note }) {
  const withData = nutrients.filter((n) => n.value !== null);
  const partial = nutrients.some((n) => n.value !== null && n.known < n.entries);
  if (!withData.length) {
    return <Text style={styles.empty}>Ningún registro trae micronutrientes. Buscá en FatSecret al registrar una comida para sumarlos.</Text>;
  }
  return (
    <View style={styles.list}>
      {nutrients.map((n) => (
        <View key={n.key} style={styles.row} accessibilityLabel={`${n.label}: ${n.value === null ? 'sin datos' : `${fmt(n.value)} ${n.unit}, ${n.percent} % del valor diario`}`}>
          <View style={styles.head}>
            <Text style={styles.label}>
              {n.label}
              {n.kind === 'limit' ? <Text style={styles.kind}> · límite</Text> : null}
            </Text>
            <Text style={styles.value}>
              {n.value === null ? '—' : `${fmt(n.value)} ${n.unit}`}
              <Text style={styles.daily}> / {fmt(n.daily)} {n.unit}</Text>
            </Text>
          </View>
          <View style={styles.track}>
            {n.value !== null ? <View style={[styles.fill, { width: `${Math.min(n.percent, 100)}%`, backgroundColor: barColor(n) }]} /> : null}
          </View>
        </View>
      ))}
      <Text style={styles.note}>
        {note ?? 'Valores diarios de referencia para adultos (FDA).'}
        {partial ? ' Algunos alimentos no informan todos los micronutrientes: el total puede ser mayor.' : ''}
      </Text>
    </View>
  );
}

/** Lo que ve el plan gratis en lugar de una función Pro. */
export function ProTeaser({ title = 'Micronutrientes', text = 'Vitaminas, minerales, fibra y sodio de cada comida, con MacroEntreno Pro.' }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/pro')} accessibilityRole="button" style={({ pressed }) => [styles.teaser, continuous, pressed && { opacity: 0.85 }]}>
      <View style={styles.lock}>
        <Ionicons name="lock-closed" size={18} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.teaserTitle}>{title}</Text>
        <Text style={styles.teaserText}>{text}</Text>
      </View>
      <Text style={styles.teaserCta}>Ver Pro</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: colors.text, fontSize: font.md, fontWeight: '500' },
  kind: { color: colors.muted, fontSize: font.xs, fontWeight: '400' },
  value: { ...numeric, color: colors.text, fontSize: font.sm, fontWeight: '600' },
  daily: { color: colors.muted, fontWeight: '400' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  note: { color: colors.muted, fontSize: font.xs },
  empty: { color: colors.muted, fontSize: font.sm },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(48,209,88,0.35)' },
  lock: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  teaserTitle: { color: colors.text, fontSize: font.md + 1, fontWeight: '600' },
  teaserText: { color: colors.muted, fontSize: font.sm },
  teaserCta: { color: colors.primary, fontSize: font.md, fontWeight: '600' },
});
