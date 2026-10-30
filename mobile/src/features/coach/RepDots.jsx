import { StyleSheet, View } from 'react-native';
import { colors, createStyles, useTheme } from '../../theme';

/** Un punto por repetición de la serie: verde si contó, rojo si no. Huecos vacíos hasta el objetivo. */
export function RepDots({ log, target = 0, large = false }) {
  useTheme();
  const good = log.filter((mark) => mark.ok).length;
  const empty = Math.max(0, target - good);
  if (log.length === 0 && empty === 0) return null;
  const size = large ? styles.large : null;
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel={`${good} bien, ${log.length - good} para corregir`}>
      {log.map((mark, index) => (
        <View key={index} style={[styles.dot, size, { backgroundColor: mark.ok ? colors.primary : colors.danger }]} />
      ))}
      {Array.from({ length: empty }, (_, index) => (
        <View key={`e${index}`} style={[styles.dot, size, styles.empty]} />
      ))}
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  large: { width: 13, height: 13, borderRadius: 7 },
  empty: { borderWidth: 1.5, borderColor: 'rgba(235,235,245,0.3)' },
}));
