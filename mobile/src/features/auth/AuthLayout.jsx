import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, continuous, font, spacing, tracking } from '../../theme';

/** Marco común de login y registro: centrado y con ancho máximo (sirve en tablet y horizontal). */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brand}>
              <View style={[styles.logo, continuous]}>
                <Ionicons name="barbell" size={38} color={colors.onPrimary} />
              </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.md },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  appName: { color: colors.muted, fontSize: font.md, fontWeight: '600', letterSpacing: 0.2 },
  heading: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: font.display, fontWeight: '700', letterSpacing: tracking.display, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: font.body, textAlign: 'center' },
});
