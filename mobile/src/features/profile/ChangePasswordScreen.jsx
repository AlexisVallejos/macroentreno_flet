import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, FormError, Screen, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../utils/confirm';
import { validatePassword } from '../../utils/validation';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const found = {};
    if (user.hasPassword && !form.current) found.current = 'Ingresá tu contraseña actual';
    const pwd = validatePassword(form.next);
    if (pwd) found.next = pwd;
    if (form.next !== form.confirm) found.confirm = 'Las contraseñas no coinciden';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await changePassword(form.current || undefined, form.next);
      notify('Listo', 'Tu contraseña se actualizó. Se cerró la sesión en tus otros dispositivos.');
      router.back();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <FormError message={formError} />
      {user.hasPassword ? (
        <TextField label="Contraseña actual" value={form.current} onChangeText={set('current')} error={errors.current} secureTextEntry />
      ) : null}
      <TextField
        label="Nueva contraseña"
        value={form.next}
        onChangeText={set('next')}
        error={errors.next}
        hint="Mínimo 8 caracteres, con letras y números"
        secureTextEntry
      />
      <TextField label="Repetir nueva contraseña" value={form.confirm} onChangeText={set('confirm')} error={errors.confirm} secureTextEntry />
      <Button title="Guardar" onPress={save} loading={saving} />
    </Screen>
  );
}
