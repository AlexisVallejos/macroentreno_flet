import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchProviders } from '../../api/socialLogin';
import { useAuth } from '../../context/AuthContext';
import { colors, font, radius, spacing } from '../../theme';

const PROVIDERS = [
  { id: 'google', label: 'Google', icon: 'logo-google', color: '#EA4335' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { id: 'github', label: 'GitHub', icon: 'logo-github', color: '#FFFFFF' },
];

/** Botones de inicio de sesión con redes sociales. Se desactivan los que el servidor no tiene configurados. */
export function SocialButtons({ onError, disabled }) {
  const { socialLogin } = useAuth();
  const [configured, setConfigured] = useState(null); // null = sin info (el servidor no respondió)
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetchProviders()
      .then((list) => setConfigured(Object.fromEntries(list.map((p) => [p.id, p.configured]))))
      .catch(() => setConfigured(null));
  }, []);

  const handlePress = async (provider) => {
    if (configured && !configured[provider.id]) {
      onError(`El inicio de sesión con ${provider.label} todavía no está configurado en el servidor.`);
      return;
    }
    onError(null);
    setBusy(provider.id);
    try {
      await socialLogin(provider.id);
    } catch (err) {
      if (err.code !== 'CANCELLED') onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>o continuá con</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.row}>
        {PROVIDERS.map((p) => {
          const off = configured && !configured[p.id];
          return (
            <Pressable
              key={p.id}
              onPress={() => handlePress(p)}
              disabled={disabled || Boolean(busy)}
              accessibilityRole="button"
              accessibilityLabel={`Iniciar sesión con ${p.label}`}
              style={({ pressed }) => [styles.btn, (off || pressed) && { opacity: 0.5 }]}
            >
              {busy === p.id ? <ActivityIndicator color={p.color} /> : <Ionicons name={p.icon} size={20} color={p.color} />}
              <Text style={styles.label}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: font.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btn: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  label: { color: colors.text, fontWeight: '600', fontSize: font.sm },
});
