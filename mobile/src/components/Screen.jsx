import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { colors, MAX_CONTENT_WIDTH, spacing } from '../theme';

/**
 * Contenedor base de cada pantalla: scroll, pull-to-refresh y ancho máximo
 * centrado para que en tablets u horizontal el contenido no se estire.
 */
export function Screen({ children, onRefresh, refreshing = false, scroll = true, style, footer }) {
  const content = <View style={[styles.inner, style]}>{children}</View>;
  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
