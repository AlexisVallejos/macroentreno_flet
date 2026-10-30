import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiApi } from '../../api/endpoints';
import { colors, continuous, createStyles, font, MAX_CONTENT_WIDTH, radius, spacing, useTheme } from '../../theme';
import { pickImage } from '../../utils/media';
import { playSpeech, stopSpeech, useVoiceRecorder } from './voice';

/** Mensajes que se mandan como contexto: los últimos, para que la charla no crezca sin límite. */
const HISTORY = 16;

const SUGGESTIONS = [
  { icon: 'pie-chart-outline', text: '¿Cuánta proteína me falta hoy?' },
  { icon: 'restaurant-outline', text: 'Anotá 2 empanadas de carne en la cena' },
  { icon: 'barbell-outline', text: 'Armame una rutina de pecho y tríceps para hoy' },
  { icon: 'camera-outline', text: 'Analizá la foto de mi plato' },
];

const ACTION_ICON = { diary: 'restaurant', workout: 'barbell', exercise: 'library', food: 'nutrition' };

/**
 * Asistente con IA: se le habla o escribe, se le pueden mandar fotos de comidas, y registra
 * comidas, alimentos y entrenamientos usando la API con los permisos del usuario.
 */
export default function AssistantScreen() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef(null);
  const { recording, start, stop } = useVoiceRecorder();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(null); // 'thinking' | 'transcribing'
  const [error, setError] = useState(null);
  const [speakAll, setSpeakAll] = useState(false);

  useEffect(() => stopSpeech, []);

  const send = async (content = text, { spoken = false } = {}) => {
    const body = content.trim();
    if ((!body && !image) || busy) return;
    const userMessage = { role: 'user', text: body, image: image ?? undefined };
    const next = [...messages, userMessage];
    setMessages(next);
    setText('');
    setImage(null);
    setError(null);
    setBusy('thinking');
    try {
      const res = await aiApi.chat(next.slice(-HISTORY).map(({ role, text: t, image: img }) => ({ role, text: t, image: img })));
      setMessages((list) => [...list, { role: 'assistant', text: res.reply, actions: res.actions }]);
      if (spoken || speakAll) {
        aiApi
          .speech(res.reply)
          .then((s) => playSpeech(s.audio))
          .catch(() => {}); // si falla la voz, la respuesta igual quedó escrita
      }
    } catch (err) {
      setError(err.message);
      // Se devuelve el texto al campo para no perder lo escrito.
      setMessages((list) => list.slice(0, -1));
      setText(body);
      setImage(userMessage.image ?? null);
    } finally {
      setBusy(null);
    }
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
    } catch (err) {
      setBusy(null);
      setError(err.message);
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

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
      <Stack.Screen
        options={{
          title: 'Asistente',
          headerRight: () => (
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
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, continuous]}>
              <Ionicons name="sparkles" size={30} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>¿En qué te ayudo?</Text>
            <Text style={styles.emptyText}>
              Hablame o escribime. Puedo anotar tus comidas, analizar la foto de un plato, armar y guardar entrenamientos, y decirte cómo vas con tus macros.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s.text}
                  onPress={() => (s.icon === 'camera-outline' ? attach('camera') : send(s.text))}
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
          messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowUser]}>
              <View style={[styles.bubble, continuous, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
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
        {busy ? (
          <View style={styles.bubbleRow}>
            <View style={[styles.bubble, styles.botBubble, styles.typing, continuous]}>
              <ActivityIndicator color={colors.muted} size="small" />
              <Text style={styles.typingText}>{busy === 'transcribing' ? 'Escuchando lo que dijiste…' : 'Pensando…'}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

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
            maxLength={2000}
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
      </View>
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
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: font.md, textAlign: 'center', maxWidth: 420, lineHeight: 21 },
  suggestions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.card },
  suggestionText: { color: colors.text, fontSize: font.md, flex: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
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
}));
