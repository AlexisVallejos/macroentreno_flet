import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../api/client';
import { Button, Card, FormError, Grid, ListItem, RoleBadge, Screen, TextField, ThemeSwitch } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, createStyles, font, spacing, tracking, useTheme } from '../../theme';
import { confirm } from '../../utils/confirm';
import { GoalsForm } from '../users/GoalsForm';

export default function ProfileScreen() {
  useTheme();
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    if (name.trim().length < 2) return setNameError('Ingresá un nombre');
    setSaving(true);
    setNameError(null);
    try {
      await updateProfile({ name: name.trim() });
    } catch (err) {
      setNameError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (await confirm('Cerrar sesión', '¿Querés salir de tu cuenta?', { confirmText: 'Salir' })) logout();
  };

  return (
    <Screen>
      <View style={styles.header}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.muted}>{user.email ?? 'Cuenta de red social sin email'}</Text>
          <RoleBadge role={user.role} />
        </View>
      </View>

      <Card title="Opciones">
        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>Apariencia: modo claro, oscuro o el del teléfono</Text>
          <ThemeSwitch />
        </View>
        <ListItem
          icon="sparkles"
          title="Asistente con IA"
          subtitle="Por voz o texto: anota comidas, analiza fotos y arma rutinas"
          onPress={() => router.push('/assistant')}
        />
      </Card>

      <Grid>
        <Card title="Datos personales">
          <FormError message={nameError} />
          <TextField label="Nombre" value={name} onChangeText={setName} />
          <Button title="Guardar nombre" variant="secondary" onPress={saveName} loading={saving} disabled={name === user.name} />
        </Card>

        {user.role === 'athlete' ? (
          <Card title="Mis objetivos diarios">
            <GoalsForm key={user.id} goals={user.goals} onSave={(goals) => updateProfile({ goals })} />
            {user.coachName ? <Text style={styles.muted}>Tu entrenador ({user.coachName}) también puede ajustarlos.</Text> : null}
          </Card>
        ) : null}
      </Grid>

      <Card>
        <ListItem
          icon="sparkles"
          title="MacroEntreno Pro"
          subtitle={
            user.plan?.source === 'role'
              ? 'Incluido con tu rol'
              : user.plan?.pro
                ? `Activo hasta el ${new Date(String(user.plan.proUntil).replace(' ', 'T')).toLocaleDateString('es-AR')}`
                : 'Micronutrientes y base de FatSecret · probalo'
          }
          onPress={() => router.push('/pro')}
        />
        {user.role === 'athlete' ? (
          <ListItem icon="nutrition-outline" title="Mis alimentos" subtitle="Creá y editá tus alimentos personalizados" onPress={() => router.push('/foods')} />
        ) : null}
        <ListItem
          icon="key-outline"
          title={user.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
          subtitle={user.hasPassword ? undefined : 'Para poder ingresar también con email'}
          onPress={() => router.push('/change-password')}
        />
        <ListItem icon="log-out-outline" iconColor={colors.danger} title="Cerrar sesión" onPress={handleLogout} />
      </Card>

      <Text style={styles.footer}>MacroEntreno 1.0 · API: {API_URL}</Text>
    </Screen>
  );
}

const styles = createStyles(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: font.xxl, fontWeight: '700' },
  name: { color: colors.text, fontSize: font.xl + 2, fontWeight: '700', letterSpacing: tracking.title },
  muted: { color: colors.muted, fontSize: font.sm },
  footer: { color: colors.muted, fontSize: font.xs, textAlign: 'center' },
}));
