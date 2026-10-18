import { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { spacing } from '../theme';

/** Grilla responsiva: 1 columna en teléfono vertical, 2-3 en horizontal/tablet. */
export function Grid({ children, min = 1 }) {
  const { columns } = useResponsive();
  const cols = Math.max(columns, min);
  return (
    <View style={styles.grid}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: cols === 1 ? '100%' : `${100 / cols - 2}%`, flexGrow: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
