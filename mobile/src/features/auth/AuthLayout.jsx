import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, spacing } from '../../theme';

/** Marco común de login y registro: centrado y con ancho máximo (sirve en tablet y horizontal). */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="barbell" size={28} color="#fff" />
              </View>
              <Text style={styles.appName}>MacroEntreno</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: '800', marginTop: spacing.md },
  subtitle: { color: colors.muted, fontSize: font.md, marginTop: -spacing.sm },
});
