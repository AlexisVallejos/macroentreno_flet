import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { billingApi, usersApi } from '../../api/endpoints';
import { Button, Card, Chips, ErrorState, FormError, Loading, Screen, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, font, spacing } from '../../theme';
import { confirm } from '../../utils/confirm';
import { ROLES } from '../../utils/constants';
import { isEmail, validatePassword } from '../../utils/validation';

/** Alta / edición / baja de usuarios, cambio de rol y asignación de entrenador (admin). */
export default function UserFormScreen() {
  const router = useRouter();
  const { user: me } = useAuth();
  const { id: idParam } = useLocalSearchParams();
  const id = idParam ? Number(idParam) : null;
  const isSelf = id === me.id;

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'athlete', coachId: null, isActive: true });
  const [coaches, setCoaches] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    usersApi
      .list({ role: 'coach', limit: 100 })
      .then((res) => setCoaches(res.data))
      .catch(() => {});
    if (!id) return;
    usersApi
      .get(id)
      .then((u) => {
        setForm({ name: u.name, email: u.email || '', password: '', role: u.role, coachId: u.coachId, isActive: u.isActive });
        setPlan(u.plan);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id]);

  /** Regala días de MacroEntreno Pro (se suman) o lo quita con 0. */
  const grantPro = async (days) => {
    setGranting(true);
    setFormError(null);
    try {
      setPlan((await billingApi.grant(id, days)).plan);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGranting(false);
    }
  };

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Ingresá un nombre';
    if (!isEmail(form.email) && (!id || form.email)) found.email = 'Email inválido';
    if (!id) {
      const pwd = validatePassword(form.password);
      if (pwd) found.password = pwd;
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const body = {
      name: form.name.trim(),
      role: form.role,
      coachId: form.role === 'athlete' ? form.coachId : null,
      ...(form.email ? { email: form.email.trim() } : {}),
    };
    setSaving(true);
    try {
      if (id) await usersApi.update(id, { ...body, isActive: form.isActive });
      else await usersApi.create({ ...body, password: form.password });
      router.back();
    } catch (err) {
      setErrors(err.fieldErrors);
      setFormError(err.status === 409 ? 'Ya existe un usuario con ese email' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Eliminar usuario', `¿Eliminar a ${form.name}? Se borran también su diario y sus entrenamientos.`))) return;
    try {
      await usersApi.remove(id);
      router.back();
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loading) return <Loading />;
  if (loadError) return <ErrorState error={loadError} onRetry={() => router.back()} />;

  return (
    <Screen
      footer={
        <View style={styles.row}>
          {id && !isSelf ? <Button title="Eliminar" variant="danger" icon="trash-outline" onPress={remove} /> : null}
          <Button title={id ? 'Guardar cambios' : 'Crear usuario'} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
      }
    >
      <Stack.Screen options={{ title: id ? 'Editar usuario' : 'Nuevo usuario' }} />
      <FormError message={formError} />
      <Card>
        <TextField label="Nombre" value={form.name} onChangeText={set('name')} error={errors.name} />
        <TextField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {!id ? (
          <TextField
            label="Contraseña inicial"
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
            secureTextEntry
            hint="El usuario puede cambiarla desde su perfil"
          />
        ) : null}
      </Card>

      <Card title="Rol">
        {isSelf ? (
          <Text style={styles.muted}>No podés cambiar tu propio rol.</Text>
        ) : (
          <Chips
            options={Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label }))}
            value={form.role}
            onChange={set('role')}
          />
        )}
        <Text style={styles.muted}>
          {form.role === 'admin'
            ? 'Acceso total: usuarios, catálogo y datos de todos.'
            : form.role === 'coach'
              ? 'Ve el diario y progreso de sus atletas, les asigna rutinas y edita el catálogo.'
              : 'Registra sus comidas y entrenamientos.'}
        </Text>
      </Card>

      {form.role === 'athlete' ? (
        <Card title="Entrenador asignado">
          <Chips
            options={[{ value: null, label: 'Sin entrenador' }, ...coaches.map((c) => ({ value: c.id, label: c.name }))]}
            value={form.coachId}
            onChange={set('coachId')}
          />
        </Card>
      ) : null}

      {id && form.role === 'athlete' && plan ? (
        <Card title="MacroEntreno Pro">
          <Text style={styles.muted}>
            {plan.pro ? `Activo hasta el ${new Date(String(plan.proUntil).replace(' ', 'T')).toLocaleDateString('es-AR')}` : 'Plan gratis'}
          </Text>
          <View style={styles.row}>
            <Button title="Regalar 30 días" icon="gift" variant="tinted" small onPress={() => grantPro(30)} loading={granting} />
            {plan.pro ? <Button title="Quitar Pro" variant="danger" small onPress={() => grantPro(0)} disabled={granting} /> : null}
          </View>
        </Card>
      ) : null}

      {id && !isSelf ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Cuenta activa</Text>
            <Text style={styles.muted}>Si la desactivás, se cierran sus sesiones y no puede ingresar.</Text>
          </View>
          <Switch value={form.isActive} onValueChange={set('isActive')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  muted: { color: colors.muted, fontSize: font.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { color: colors.text, fontSize: font.md, fontWeight: '600' },
});
