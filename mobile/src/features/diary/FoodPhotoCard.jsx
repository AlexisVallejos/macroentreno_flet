import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { aiApi, diaryApi } from '../../api/endpoints';
import { Button, Card, FormError, Loading, MacroInline, TextField } from '../../components';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';
import { pickImage } from '../../utils/media';
import { round1 } from '../../utils/format';
import { toNumber } from '../../utils/validation';

const CONFIDENCE = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja: revisá los gramos' };

/** Macros del alimento escalados a los gramos que eligió el usuario. */
const scaled = (item) => {
  const f = (toNumber(item.grams) || 0) / item.base.gramos;
  return { kcal: round1(item.base.kcal * f), protein: round1(item.base.proteinas * f), carbs: round1(item.base.carbohidratos * f), fat: round1(item.base.grasas * f) };
};

/**
 * Foto de un plato → la IA dice qué es, cuánto pesa y sus macros. El usuario ajusta los gramos,
 * descarta lo que no comió y lo agrega al diario en un toque.
 */
export function FoodPhotoCard({ date, meal, onDone }) {
  useTheme();
  const [image, setImage] = useState(null);
  const [note, setNote] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null); // 'analyzing' | 'saving'
  const [error, setError] = useState(null);

  const choose = async (source) => {
    setError(null);
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      setImage(picked);
      setAnalysis(null);
      await analyze(picked);
    } catch (err) {
      setError(err.message);
    }
  };

  const analyze = async (img = image) => {
    setBusy('analyzing');
    setError(null);
    try {
      const result = await aiApi.foodPhoto(img, note.trim() || undefined);
      setAnalysis(result);
      setItems(result.items.map((it, i) => ({ key: i, base: it, grams: String(Math.round(it.gramos)), include: true })));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const chosen = items.filter((it) => it.include && toNumber(it.grams) > 0);
  const total = chosen.reduce(
    (acc, it) => {
      const m = scaled(it);
      return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const save = async () => {
    setBusy('saving');
    setError(null);
    try {
      for (const it of chosen) {
        const m = scaled(it);
        await diaryApi.create({ date, meal, name: it.base.nombre, grams: toNumber(it.grams), ...m });
      }
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  if (!image) {
    return (
      <Card>
        <View style={styles.intro}>
          <View style={[styles.introIcon, continuous]}>
            <Ionicons name="sparkles" size={26} color={colors.primary} />
          </View>
          <Text style={styles.introTitle}>Sacale una foto a tu plato</Text>
          <Text style={styles.muted}>La IA reconoce cada alimento, estima cuánto pesa y calcula los macros. Después podés ajustar los gramos antes de guardar.</Text>
        </View>
        <FormError message={error} />
        <View style={styles.row}>
          <Button title="Sacar foto" icon="camera-outline" onPress={() => choose('camera')} style={{ flex: 1 }} />
          <Button title="Galería" icon="images-outline" variant="secondary" onPress={() => choose('library')} style={{ flex: 1 }} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Image source={{ uri: image }} style={[styles.photo, continuous]} resizeMode="cover" accessibilityLabel="Foto del plato" />
      <FormError message={error} />
      {busy === 'analyzing' ? <Loading label="Analizando el plato…" /> : null}

      {analysis && !busy ? (
        analysis.esComida && items.length ? (
          <>
            <View style={{ gap: 4 }}>
              <Text style={styles.description}>{analysis.descripcion}</Text>
              <Text style={styles.muted}>{CONFIDENCE[analysis.confianza]} · valores estimados</Text>
            </View>
            {items.map((it) => (
              <View key={it.key} style={[styles.item, !it.include && styles.itemOff]}>
                <Pressable
                  onPress={() => update(it.key, { include: !it.include })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: it.include }}
                  accessibilityLabel={`Incluir ${it.base.nombre}`}
                  hitSlop={8}
                  style={styles.check}
                >
                  <Ionicons name={it.include ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={it.include ? colors.primary : colors.muted} />
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.itemName}>{it.base.nombre}</Text>
                  {it.include ? <MacroInline {...scaled(it)} /> : null}
                </View>
                <TextField
                  label="Gramos"
                  value={it.grams}
                  onChangeText={(v) => update(it.key, { grams: v })}
                  keyboardType="decimal-pad"
                  editable={it.include}
                  style={styles.grams}
                />
              </View>
            ))}
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Total</Text>
              <MacroInline {...total} />
            </View>
            <Button
              title={`Agregar ${chosen.length} ${chosen.length === 1 ? 'alimento' : 'alimentos'}`}
              icon="add-circle-outline"
              onPress={save}
              disabled={!chosen.length}
              loading={busy === 'saving'}
            />
          </>
        ) : (
          <Text style={styles.muted}>No reconocimos comida en la foto. Probá con otra más cerca y con buena luz.</Text>
        )
      ) : null}

      {!busy ? (
        <>
          <TextField
            label="Aclaración (opcional)"
            placeholder="Ej.: la milanesa es de pollo, comí la mitad"
            value={note}
            onChangeText={setNote}
            hint="Si algo no salió bien, aclaralo y volvé a analizar."
          />
          <View style={styles.row}>
            <Button title="Volver a analizar" icon="refresh" variant="secondary" onPress={() => analyze()} style={{ flex: 1 }} />
            <Button title="Otra foto" icon="camera-outline" variant="ghost" onPress={() => choose('camera')} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = createStyles(() => StyleSheet.create({
  intro: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  introIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  introTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.muted, fontSize: font.sm, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.fill },
  description: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemOff: { opacity: 0.5 },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  itemName: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  grams: { width: 96 },
  total: { gap: 6, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  totalLabel: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
}));
