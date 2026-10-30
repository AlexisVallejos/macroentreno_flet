import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, FormError, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, createStyles, font, spacing, useTheme } from '../../theme';
import { validateRegister } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';
import { SocialButtons } from './SocialButtons';

export default function RegisterScreen() {
  useTheme();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const found = validateRegister(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
    } catch (err) {
      setErrors(err.fieldErrors ?? {});
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Las cuentas nuevas se crean con rol Atleta.">
      <FormError message={formError} />
      <TextField label="Nombre" value={form.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextField
        label="Contraseña"
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        hint="Mínimo 8 caracteres, con letras y números"
        secureTextEntry
        autoComplete="new-password"
      />
      <TextField
        label="Repetir contraseña"
        value={form.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm}
        secureTextEntry
        onSubmitEditing={submit}
      />
      <Button title="Crear cuenta" onPress={submit} loading={loading} />
      <SocialButtons onError={setFormError} disabled={loading} />
      <View style={styles.footer}>
        <Text style={styles.muted}>¿Ya tenés cuenta?</Text>
        <Link href="/login" style={styles.link}>
          Iniciá sesión
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = createStyles(() => StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  muted: { color: colors.muted, fontSize: font.md },
  link: { color: colors.primary, fontSize: font.md, fontWeight: '700' },
}));
