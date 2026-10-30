import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo, ThemeToggleButton } from '../../components';
import { colors, createStyles, font, spacing, tracking, useTheme } from '../../theme';

/** Marco común de login y registro: centrado y con ancho máximo (sirve en tablet y horizontal). */
export function AuthLayout({ title, subtitle, children }) {
  useTheme();
  return (
    <SafeAreaView style={styles.root}>
      <ThemeToggleButton style={styles.toggle} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brand}>
              <Logo size={120} />
              <Text style={styles.appName}>MacroEntreno</Text>
            </View>
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.md },
  toggle: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  appName: { color: colors.muted, fontSize: font.md, fontWeight: '600', letterSpacing: 0.2 },
  heading: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: font.display, fontWeight: '700', letterSpacing: tracking.display, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: font.body, textAlign: 'center' },
}));
