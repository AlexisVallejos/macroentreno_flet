import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiApi } from '../../api/endpoints';
import { Button } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useResource } from '../../hooks/useResource';
import { colors, continuous, createStyles, font, MAX_CONTENT_WIDTH, radius, spacing, useTheme } from '../../theme';
import { confirm } from '../../utils/confirm';
import { pickImage } from '../../utils/media';
import { AssistantSetup, SETUP_CODES } from './AssistantSetup';
import { playSpeech, stopSpeech, useVoiceRecorder } from './voice';

/** Mensajes que se mandan como contexto: los últimos, para que la charla no crezca sin límite. */
const HISTORY = 16;
/** Largo máximo de un mensaje (el servidor acepta hasta 4000). */
const MAX_CHARS = 2000;
/** Después de este tiempo esperando se avisa que la respuesta puede tardar (fotos, varias herramientas). */
const SLOW_MS = 15000;

const PHOTO = { icon: 'camera-outline', text: 'Analizá la foto de mi plato', photo: true };
const SUGGESTIONS = {
  athlete: [
    { icon: 'pie-chart-outline', text: '¿Cuánta proteína me falta hoy?' },
    { icon: 'restaurant-outline', text: 'Anotá 2 empanadas de carne en la cena' },
    { icon: 'barbell-outline', text: 'Armame una rutina de pecho y tríceps para hoy' },
    PHOTO,
  ],
  coach: [
    { icon: 'people-outline', text: 'Armá una rutina full body de 3 días para un atleta principiante' },
    { icon: 'library-outline', text: 'Agregá "Hip thrust con barra" al catálogo de ejercicios' },
    { icon: 'pie-chart-outline', text: '¿Cómo vengo hoy con mis macros?' },
    PHOTO,
  ],
  admin: [
    { icon: 'library-outline', text: 'Agregá "Remo en máquina" al catálogo de ejercicios' },
    { icon: 'nutrition-outline', text: 'Creá el alimento "Tarta de verdura casera" con sus macros por porción' },
    { icon: 'pie-chart-outline', text: '¿Cómo vengo hoy con mis macros?' },
    PHOTO,
  ],
};

const ACTION_ICON = { diary: 'restaurant', workout: 'barbell', exercise: 'library', food: 'nutrition' };

/** Mensaje para mostrar: en errores de validación, el detalle del campo es más útil que el genérico. */
const errorMessage = (err) => (err.code === 'VALIDATION_ERROR' && err.details?.[0]?.message) || err.message;

/**
 * Asistente con IA: se le habla o escribe, se le pueden mandar fotos de comidas, y registra
 * comidas, alimentos y entrenamientos usando la API con los permisos del usuario.
 */
export default function AssistantScreen() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const scroll = useRef(null);
  const nextId = useRef(0);
  const { recording, start, stop } = useVoiceRecorder();
  // Se consulta al entrar (y al volver a la pantalla) si el servidor tiene la clave de OpenAI.
  const status = useResource(() => aiApi.status());
  const [setupReason, setSetupReason] = useState(null); // AI_NOT_CONFIGURED | AI_INVALID_KEY
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(null); // 'thinking' | 'transcribing'
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(null); // errores del micrófono o de las fotos
  const [failure, setFailure] = useState(null); // el último mensaje no se pudo enviar
  const [speakAll, setSpeakAll] = useState(false);

  useEffect(() => stopSpeech, []);

  useEffect(() => {
    if (busy !== 'thinking') return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  // setupReason viene de un error del chat; "volver a probar" lo limpia y vuelve a consultar el estado.
  const setup = setupReason ?? (status.data && !status.data.configured ? 'AI_NOT_CONFIGURED' : null);
  const isAdmin = user?.role === 'admin';

  /** Manda la conversación y agrega la respuesta. Si falla, el último mensaje queda para reintentar. */
  const ask = async (history, { spoken = false } = {}) => {
    setError(null);
    setFailure(null);
    setSlow(false);
    setBusy('thinking');
    try {
      const res = await aiApi.chat(history.slice(-HISTORY).map(({ role, text: t, image: img }) => ({ role, text: t, image: img })));
      setMessages((list) => [...list, { id: nextId.current++, role: 'assistant', text: res.reply, actions: res.actions }]);
      if (spoken || speakAll) {
        aiApi
          .speech(res.reply)
          .then((s) => playSpeech(s.audio))
          .catch(() => {}); // si falla la voz, la respuesta igual quedó escrita
      }
    } catch (err) {
      const last = history.at(-1);
      if (SETUP_CODES.includes(err.code) || err.code === 'VALIDATION_ERROR') {
        // No sirve reintentar igual: se devuelve el mensaje al campo para no perder lo escrito.
        setMessages((list) => list.filter((m) => m.id !== last.id));
        setText(last.text);
        setImage(last.image ?? null);
        if (SETUP_CODES.includes(err.code)) setSetupReason(err.code);
        else setError(errorMessage(err));
      } else {
        setMessages((list) => list.map((m) => (m.id === last.id ? { ...m, failed: true } : m)));
        setFailure({ message: errorMessage(err), spoken });
      }
    } finally {
      setBusy(null);
    }
  };

  const send = async (content = text, { spoken = false } = {}) => {
    const body = content.trim().slice(0, MAX_CHARS);
    if ((!body && !image) || busy) return;
    const userMessage = { id: nextId.current++, role: 'user', text: body, image: image ?? undefined };
    // Un mensaje nuevo reemplaza al que no se pudo enviar.
    const next = [...messages.filter((m) => !m.failed), userMessage];
    setMessages(next);
    setText('');
    setImage(null);
    await ask(next, { spoken });
  };

  const retry = () => {
    if (busy) return;
    const next = messages.map((m) => (m.failed ? { ...m, failed: false } : m));
    setMessages(next);
    ask(next, { spoken: failure?.spoken });
  };

  const clearChat = async () => {
    const ok = await confirm('¿Borrar la conversación?', 'Se borran los mensajes de esta pantalla. Lo que el asistente registró queda guardado.', { confirmText: 'Borrar' });
    if (!ok) return;
    stopSpeech();
    setMessages([]);
    setFailure(null);
    setError(null);
  };

  const recheck = () => {
    setSetupReason(null);
    status.reload();
  };

  const toggleMic = async () => {
    setError(null);
    try {
      if (!recording) return await start();
      const clip = await stop();
      if (!clip) return;
      setBusy('transcribing');
      const { text: heard } = await aiApi.transcribe(clip.audio, clip.mimeType);
      setBusy(null);
      if (heard) await send(heard, { spoken: true });
      else setError('No te escuché bien, probá de nuevo más cerca del micrófono');
    } catch (err) {
      setBusy(null);
      if (SETUP_CODES.includes(err.code)) setSetupReason(err.code);
      else setError(err.message);
    }
  };

  const attach = async (source) => {
    setError(null);
    try {
      const picked = await pickImage(source);
      if (picked) setImage(picked);
    } catch (err) {
      setError(err.message);
    }
  };

  const canSend = Boolean(text.trim() || image) && !busy;
  const suggestions = SUGGESTIONS[user?.role] ?? SUGGESTIONS.athlete;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
      <Stack.Screen
        options={{
          title: 'Asistente',
          headerRight: () => (
            <View style={styles.headerActions}>
              {messages.length > 0 && !busy ? (
                <Pressable onPress={clearChat} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la conversación" style={styles.headerButton}>
                  <Ionicons name="trash-outline" size={21} color={colors.primary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  if (speakAll) stopSpeech();
                  setSpeakAll(!speakAll);
                }}
                hitSlop={10}
                accessibilityRole="switch"
                accessibilityState={{ checked: speakAll }}
                accessibilityLabel="Leer todas las respuestas en voz alta"
                style={styles.headerButton}
              >
                <Ionicons name={speakAll ? 'volume-high' : 'volume-mute-outline'} size={22} color={colors.primary} />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {setup ? (
          <AssistantSetup reason={setup} isAdmin={isAdmin} onRecheck={recheck} checking={status.refreshing} />
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, continuous]}>
              <Ionicons name="sparkles" size={30} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>¿En qué te ayudo?</Text>
            <Text style={styles.emptyText}>
              Hablame o escribime. Puedo anotar tus comidas, analizar la foto de un plato, armar y guardar entrenamientos, y decirte cómo vas con tus macros.
            </Text>
            {isAdmin && status.data?.warning ? <Text style={styles.warning}>{status.data.warning}</Text> : null}
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.text}
                  onPress={() => (s.photo ? attach('camera') : send(s.text))}
                  disabled={Boolean(busy)}
                  style={({ pressed }) => [styles.suggestion, continuous, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name={s.icon} size={18} color={colors.primary} />
                  <Text style={styles.suggestionText}>{s.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowUser]}>
              <View style={[styles.bubble, continuous, m.role === 'user' ? styles.userBubble : styles.botBubble, m.failed && styles.failedBubble]}>
                {m.image ? <Image source={{ uri: m.image }} style={[styles.bubbleImage, continuous]} accessibilityLabel="Foto enviada" /> : null}
                {m.text ? <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.text}</Text> : null}
                {m.actions?.map((a, j) => (
                  <Pressable
                    key={j}
                    onPress={() => router.push(a.type === 'workout' ? '/workouts' : a.type === 'diary' ? '/diary' : '/')}
                    style={({ pressed }) => [styles.action, continuous, pressed && { opacity: 0.6 }]}
                    accessibilityRole="link"
                  >
                    <Ionicons name={ACTION_ICON[a.type] ?? 'checkmark'} size={15} color={colors.primary} />
                    <Text style={styles.actionText}>{a.label}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.chevron} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
        {failure && !busy ? (
          <View style={[styles.failure, continuous]} accessibilityRole="alert">
            <View style={styles.failureRow}>
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
              <Text style={styles.failureText}>{failure.message}</Text>
            </View>
            <Button title="Reintentar" icon="refresh" variant="danger" small onPress={retry} style={styles.retry} />
          </View>
        ) : null}
        {busy ? (
          <View style={styles.bubbleRow}>
            <View style={[styles.bubble, styles.botBubble, styles.typing, continuous]} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.muted} size="small" />
              <Text style={styles.typingText}>
                {busy === 'transcribing' ? 'Escuchando lo que dijiste…' : slow && busy === 'thinking' ? 'Sigo trabajando, puede tardar unos segundos más…' : 'Pensando…'}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {setup ? null : (
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {image ? (
            <View style={styles.preview}>
              <Image source={{ uri: image }} style={[styles.previewImage, continuous]} accessibilityLabel="Foto adjunta" />
              <Pressable onPress={() => setImage(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitar foto" style={styles.previewRemove}>
                <Ionicons name="close-circle" size={22} color={colors.text} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <IconButton icon="camera-outline" label="Sacar foto" onPress={() => attach('camera')} disabled={Boolean(busy) || recording} />
            <IconButton icon="image-outline" label="Elegir foto de la galería" onPress={() => attach('library')} disabled={Boolean(busy) || recording} />
            <TextInput
              style={[styles.input, continuous]}
              value={text}
              onChangeText={setText}
              placeholder={recording ? 'Te escucho… tocá de nuevo para enviar' : 'Escribí o hablá…'}
              placeholderTextColor={recording ? colors.danger : colors.muted}
              selectionColor={colors.primary}
              multiline
              maxLength={MAX_CHARS}
              editable={!recording}
              accessibilityLabel="Mensaje para el asistente"
              onSubmitEditing={() => send()}
              blurOnSubmit={false}
            />
            {canSend ? (
              <IconButton icon="arrow-up" label="Enviar" onPress={() => send()} filled />
            ) : (
              <IconButton icon={recording ? 'stop' : 'mic'} label={recording ? 'Terminar y enviar' : 'Hablar'} onPress={toggleMic} filled danger={recording} disabled={Boolean(busy)} />
            )}
          </View>
          {text.length > MAX_CHARS - 200 ? (
            <Text style={[styles.counter, text.length >= MAX_CHARS && { color: colors.danger }]}>
              {text.length}/{MAX_CHARS}
            </Text>
          ) : null}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function IconButton({ icon, label, onPress, filled, danger, disabled }) {
  useTheme();
  const bg = danger ? colors.danger : filled ? colors.primary : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.4 }]}
    >
      <Ionicons name={icon} size={filled ? 22 : 24} color={filled ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}

const styles = createStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: font.md, textAlign: 'center', maxWidth: 420, lineHeight: 21 },
  warning: { color: colors.warning, fontSize: font.sm, textAlign: 'center', maxWidth: 420 },
  suggestions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.card },
  suggestionText: { color: colors.text, fontSize: font.md, flex: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  failedBubble: { opacity: 0.55 },
  failure: { alignSelf: 'flex-end', maxWidth: '85%', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  failureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  failureText: { color: colors.danger, fontSize: font.sm, flex: 1 },
  retry: { alignSelf: 'flex-end' },
  userText: { color: colors.onPrimary, fontSize: font.body - 1, lineHeight: 22 },
  botText: { color: colors.text, fontSize: font.body - 1, lineHeight: 22 },
  bubbleImage: { width: 220, height: 165, borderRadius: radius.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  actionText: { color: colors.text, fontSize: font.sm, fontWeight: '600', flex: 1 },
  typing: { flexDirection: 'row', alignItems: 'center' },
  typingText: { color: colors.muted, fontSize: font.sm },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background, paddingTop: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  composer: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    backgroundColor: colors.fill,
    color: colors.text,
    fontSize: font.body - 1,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  preview: { alignSelf: 'flex-start', marginLeft: spacing.sm },
  previewImage: { width: 72, height: 72, borderRadius: radius.sm },
  previewRemove: { position: 'absolute', top: -8, right: -8 },
  error: { color: colors.danger, fontSize: font.sm, textAlign: 'center' },
  counter: { color: colors.muted, fontSize: font.xs, textAlign: 'right', width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingRight: spacing.sm },
}));
