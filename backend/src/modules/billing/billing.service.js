import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { badGateway, badRequest, conflict, unavailable } from '../../utils/httpError.js';
import { getUser } from '../users/users.service.js';
import * as mp from './mercadopago.js';

const STATUSES = ['pending', 'authorized', 'paused', 'cancelled'];
/** Días extra después de la fecha del próximo cobro, por si Mercado Pago lo procesa con demora. */
const GRACE_DAYS = 3;
const REASON = 'MacroEntreno Pro';

function toSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    nextPaymentAt: row.next_payment_at,
    createdAt: row.created_at,
  };
}

async function latestSubscription(userId) {
  const [row] = await query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [userId]);
  return row ?? null;
}

/** Estado del plan del usuario, el precio y si el servidor puede cobrar. */
export async function getPlan(userId) {
  const [user, latest] = await Promise.all([getUser(userId), latestSubscription(userId)]);
  return {
    plan: user.plan,
    price: { amount: env.billing.price, currency: env.billing.currency, period: 'month' },
    checkoutAvailable: mp.mercadoPagoConfigured() && Boolean(env.billing.appUrl),
    subscription: toSubscription(latest),
  };
}

/** Crea la suscripción en Mercado Pago (pendiente de pago) y devuelve la página donde se paga. */
export async function subscribe(userId) {
  const user = await getUser(userId);
  if (user.role !== 'athlete') throw badRequest('Tu rol ya incluye MacroEntreno Pro');
  if (user.plan.pro) throw conflict('Ya tenés MacroEntreno Pro activo');
  if (!user.email) throw badRequest('Necesitás un email en tu cuenta para pagar con Mercado Pago');
  if (!env.billing.appUrl) throw unavailable('BILLING_NOT_CONFIGURED', 'Falta configurar PUBLIC_APP_URL en el servidor');

  const pre = await mp.createPreapproval(
    {
      reason: REASON,
      external_reference: `user:${user.id}`,
      payer_email: user.email,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: env.billing.price, currency_id: env.billing.currency },
      back_url: `${env.billing.appUrl}/pro`,
      status: 'pending',
    },
    crypto.randomUUID(),
  );
  if (!pre.id || !pre.init_point) throw badGateway('MERCADOPAGO_ERROR', 'Mercado Pago no devolvió el link de pago');

  await query('INSERT INTO subscriptions (user_id, provider_id, status, amount, currency) VALUES (?, ?, ?, ?, ?)', [
    user.id,
    String(pre.id),
    STATUSES.includes(pre.status) ? pre.status : 'pending',
    env.billing.price,
    env.billing.currency,
  ]);
  return { checkoutUrl: pre.init_point, subscription: toSubscription(await latestSubscription(user.id)) };
}

/**
 * Aplica el estado de una suscripción tal como lo informa Mercado Pago (nunca lo que dice un webhook:
 * se vuelve a consultar). Si está autorizada, Pro queda activo hasta el próximo cobro (+ gracia).
 * Devuelve el id del usuario, o null si la suscripción no es de esta app.
 */
export async function applyPreapproval(pre) {
  if (!pre?.id) return null;
  const status = STATUSES.includes(pre.status) ? pre.status : 'pending';
  const next = Date.parse(pre.next_payment_date ?? '');
  const nextEpoch = Number.isFinite(next) ? Math.floor(next / 1000) : null;

  let [sub] = await query("SELECT * FROM subscriptions WHERE provider = 'mercadopago' AND provider_id = ?", [String(pre.id)]);
  if (!sub) {
    // Creada por fuera de esta API (o el registro se perdió): se reconoce por external_reference.
    const userId = Number(/^user:(\d+)$/.exec(pre.external_reference ?? '')?.[1]);
    if (!userId) return null;
    const [user] = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return null;
    await query('INSERT INTO subscriptions (user_id, provider_id, status, amount, currency) VALUES (?, ?, ?, ?, ?)', [
      userId,
      String(pre.id),
      status,
      pre.auto_recurring?.transaction_amount ?? env.billing.price,
      pre.auto_recurring?.currency_id ?? env.billing.currency,
    ]);
    [sub] = await query("SELECT * FROM subscriptions WHERE provider = 'mercadopago' AND provider_id = ?", [String(pre.id)]);
  }

  // FROM_UNIXTIME usa la misma zona horaria que NOW(), así las comparaciones de pro_until son coherentes.
  await query('UPDATE subscriptions SET status = ?, next_payment_at = FROM_UNIXTIME(?) WHERE id = ?', [status, nextEpoch, sub.id]);
  if (status === 'authorized') {
    const until = nextEpoch === null ? null : nextEpoch + GRACE_DAYS * 86_400;
    // Nunca acorta: si ya tenía Pro más largo (por ejemplo regalado por un admin), se respeta.
    await query(
      'UPDATE users SET pro_until = GREATEST(COALESCE(pro_until, NOW()), COALESCE(FROM_UNIXTIME(?), NOW() + INTERVAL 31 DAY)) WHERE id = ?',
      [until, sub.user_id],
    );
  }
  return sub.user_id;
}

/** Consulta en Mercado Pago la última suscripción del usuario (al volver del pago) y actualiza el plan. */
export async function sync(userId) {
  const latest = await latestSubscription(userId);
  if (latest) await applyPreapproval(await mp.getPreapproval(latest.provider_id));
  return getPlan(userId);
}

/** Da de baja la suscripción. Pro sigue activo hasta el final del período ya pagado. */
export async function cancel(userId) {
  const latest = await latestSubscription(userId);
  if (!latest || latest.status === 'cancelled') throw badRequest('No tenés una suscripción activa para cancelar');
  const pre = await mp.updatePreapproval(latest.provider_id, { status: 'cancelled' });
  await applyPreapproval({ ...pre, id: pre.id ?? latest.provider_id, status: pre.status ?? 'cancelled' });
  return getPlan(userId);
}

/** Webhook de Mercado Pago: solo se usa el id para volver a consultar el recurso. */
export async function handleWebhook(type, dataId) {
  if (type === 'subscription_preapproval') return applyPreapproval(await mp.getPreapproval(dataId));
  if (type === 'subscription_authorized_payment') {
    const payment = await mp.getAuthorizedPayment(dataId);
    if (payment.preapproval_id) return applyPreapproval(await mp.getPreapproval(payment.preapproval_id));
  }
  return null;
}

/** Admin: regala días de Pro (se suman a lo que ya tenga) o lo quita con days = 0. */
export async function grant(userId, days) {
  await getUser(userId);
  if (days > 0) {
    await query('UPDATE users SET pro_until = GREATEST(COALESCE(pro_until, NOW()), NOW()) + INTERVAL ? DAY WHERE id = ?', [days, userId]);
  } else {
    await query('UPDATE users SET pro_until = NULL WHERE id = ?', [userId]);
  }
  return getUser(userId);
}
