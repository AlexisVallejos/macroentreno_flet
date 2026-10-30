import { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { createStyles, spacing, useTheme } from '../theme';

/**
 * Campos lado a lado que se reparten el ancho. Si no entran (pantalla angosta),
 * pasan a la línea siguiente gracias a minWidth + flexWrap.
 */
export function FieldRow({ children, minWidth = 130 }) {
  useTheme();
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

const styles = createStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: 0 },
}));
