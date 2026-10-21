import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { billingApi } from '../../api/endpoints';
import { Button, Card, ErrorState, FormError, Loading, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, continuous, font, numeric, radius, spacing, tracking } from '../../theme';
import { confirm } from '../../utils/confirm';

const FEATURES = [
  { icon: 'leaf', title: 'Micronutrientes', text: 'Fibra, sodio, potasio, calcio, hierro y vitaminas A, C y D de cada comida, contra el valor diario.' },
  { icon: 'search', title: 'Base de FatSecret', text: 'Millones de alimentos y marcas con su panel nutricional completo.' },
  { icon: 'stats-chart', title: 'Promedios del período', text: 'Cómo venís de vitaminas y minerales en los últimos 7, 14 o 30 días.' },
  { icon: 'people', title: 'Para tu entrenador', text: 'Tu coach ve los mismos datos para ajustar tu plan.' },
];

const STATUS = { pending: 'Pago pendiente', authorized: 'Activa', paused: 'Pausada', cancelled: 'Cancelada' };
const money = (price) => price.amount.toLocaleString('es-AR', { style: 'currency', currency: price.currency, maximumFractionDigits: 0 });
const dateLabel = (value) => (value ? new Date(String(value).replace(' ', 'T')).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '');

/** Suscripción a MacroEntreno Pro con Mercado Pago. Al volver del pago se consulta el estado en el servidor. */
export default function ProScreen() {
  const { user, refreshUser } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [formError, setFormError] = useState(null);

  /** Trae el plan; si hay una suscripción la sincroniza (así funciona aunque el webhook no haya llegado). */
  const fetchInfo = useCallback(async () => {
    const plan = await billingApi.plan();
    const info = plan.subscription && user.role === 'athlete' ? await billingApi.sync() : plan;
    await refreshUser();
    return info;
  }, [user.role, refreshUser]);

  const load = useCallback(
    () =>
      fetchInfo().then(
        (next) => {
          setInfo(next);
          setError(null);
        },
        setError,
      ),
    [fetchInfo],
  );

  useEffect(() => {
    let cancelled = false;
    fetchInfo().then(
      (next) => !cancelled && setInfo(next),
      (err) => !cancelled && setError(err),
    );
    return () => {
      cancelled = true;
    };
  }, [fetchInfo]);

  const subscribe = async () => {
    setFormError(null);
    setBusy('subscribe');
    try {
      const { checkoutUrl } = await billingApi.subscribe();
      if (Platform.OS === 'web') {
        window.location.assign(checkoutUrl); // Mercado Pago vuelve a /pro y ahí se sincroniza
        return;
      }
      await WebBrowser.openBrowserAsync(checkoutUrl);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!(await confirm('Cancelar suscripción', 'Vas a seguir con Pro hasta el final del período que ya pagaste. ¿Cancelar?', { confirmText: 'Cancelar suscripción' }))) return;
    setBusy('cancel');
    try {
      setInfo(await billingApi.cancel());
      await refreshUser();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!info) return <Loading />;

  const { plan, price, subscription, checkoutAvailable } = info;
  const active = subscription && ['authorized', 'pending', 'paused'].includes(subscription.status);

  return (
    <Screen>
      <View style={[styles.hero, continuous]}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={30} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>MacroEntreno Pro</Text>
        <Text style={styles.subtitle}>Nutrición de nivel profesional: lo que comés, hasta el último miligramo.</Text>
        {plan.pro ? (
          <View style={styles.active}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.activeText}>
              {plan.source === 'role' ? 'Incluido con tu rol' : `Activo hasta el ${dateLabel(plan.proUntil)}`}
            </Text>
          </View>
        ) : null}
      </View>

      <Card>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feature}>
            <View style={[styles.featureIcon, continuous]}>
              <Ionicons name={f.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          </View>
        ))}
      </Card>

      {plan.source !== 'role' ? (
        <Card>
          <Text style={styles.price}>
            {money(price)}
            <Text style={styles.period}> / mes</Text>
          </Text>
          <Text style={styles.muted}>Se cobra todos los meses con Mercado Pago. Cancelás cuando quieras.</Text>
          {subscription ? (
            <Text style={styles.muted}>
              Suscripción: {STATUS[subscription.status]}
              {subscription.nextPaymentAt && subscription.status === 'authorized' ? ` · próximo cobro el ${dateLabel(subscription.nextPaymentAt)}` : ''}
            </Text>
          ) : null}
          <FormError message={formError} />
          {!checkoutAvailable && !plan.pro ? <Text style={styles.warning}>Los pagos todavía no están configurados en el servidor.</Text> : null}
          {!plan.pro ? (
            <Button title="Suscribirme con Mercado Pago" icon="card" onPress={subscribe} loading={busy === 'subscribe'} disabled={!checkoutAvailable || !user.email} />
          ) : null}
          {!user.email ? <Text style={styles.muted}>Para pagar necesitás un email en tu cuenta.</Text> : null}
          {subscription?.status === 'pending' ? <Button title="Ya pagué: actualizar estado" variant="secondary" icon="refresh" onPress={load} /> : null}
          {active && subscription.status !== 'pending' ? (
            <Button title="Cancelar suscripción" variant="danger" onPress={cancel} loading={busy === 'cancel'} />
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.card },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { color: colors.text, fontSize: font.display - 4, fontWeight: '700', letterSpacing: tracking.display, marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: font.md, textAlign: 'center' },
  active: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  activeText: { color: colors.primary, fontSize: font.md, fontWeight: '600' },
  feature: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  featureIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  featureText: { color: colors.muted, fontSize: font.sm },
  price: { ...numeric, color: colors.text, fontSize: font.xxl, fontWeight: '700', letterSpacing: tracking.title },
  period: { color: colors.muted, fontSize: font.body, fontWeight: '500' },
  muted: { color: colors.muted, fontSize: font.sm },
  warning: { color: colors.warning, fontSize: font.sm, fontWeight: '600' },
});
