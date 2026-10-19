import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, FormError, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, font, spacing } from '../../theme';
import { validateLogin } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';
import { SocialButtons } from './SocialButtons';

export default function LoginScreen() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const found = validateLogin(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setErrors(err.fieldErrors ?? {});
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Iniciá sesión" subtitle="Registrá tus comidas y entrenamientos.">
      <FormError message={formError} />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="tu@email.com"
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        placeholder="••••••••"
      />
      <Button title="Ingresar" onPress={submit} loading={loading} />
      <SocialButtons onError={setFormError} disabled={loading} />
      <View style={styles.footer}>
        <Text style={styles.muted}>¿No tenés cuenta?</Text>
        <Link href="/register" style={styles.link}>
          Registrate
        </Link>
      </View>
      <Text style={styles.demo}>
        Demo: admin@ · coach@ · atleta@macroentreno.com — contraseña Demo1234
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  muted: { color: colors.muted, fontSize: font.md },
  link: { color: colors.primary, fontSize: font.md, fontWeight: '600' },
  demo: { color: colors.muted, fontSize: font.xs, textAlign: 'center' },
});
