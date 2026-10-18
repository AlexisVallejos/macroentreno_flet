import { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';

/**
 * Campos lado a lado que se reparten el ancho. Si no entran (pantalla angosta),
 * pasan a la línea siguiente gracias a minWidth + flexWrap.
 */
export function FieldRow({ children, minWidth = 130 }) {
  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={[styles.cell, { minWidth }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: 0 },
});
