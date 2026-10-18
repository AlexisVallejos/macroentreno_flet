import { useState } from 'react';
import { View } from 'react-native';
import { Button, FieldRow, FormError, TextField } from '../../components';
import { spacing } from '../../theme';
import { toNumber, validateNumbers } from '../../utils/validation';

const FIELDS = [
  ['kcal', 'Calorías (kcal)'],
  ['protein', 'Proteínas (g)'],
  ['carbs', 'Carbohidratos (g)'],
  ['fat', 'Grasas (g)'],
];

/**
 * Formulario de objetivos diarios. Lo usan el perfil propio y el coach sobre su atleta.
 * Quien lo usa le pasa `key` (id del usuario) para reiniciarlo al cambiar de usuario.
 */
export function GoalsForm({ goals, onSave }) {
  const toForm = (g) => Object.fromEntries(FIELDS.map(([k]) => [k, String(g?.[k] ?? '')]));
  const [form, setForm] = useState(toForm(goals));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const found = validateNumbers(form, FIELDS.map(([k]) => k));
    if (!found.kcal && (toNumber(form.kcal) < 800 || toNumber(form.kcal) > 10000)) found.kcal = 'Entre 800 y 10000';
    setErrors(found);
    setFormError(null);
    setSaved(false);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSave(Object.fromEntries(FIELDS.map(([k]) => [k, Math.round(toNumber(form[k]))])));
      setSaved(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <FormError message={formError} />
      <FieldRow>
        {FIELDS.map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            value={form[key]}
            onChangeText={(v) => {
              setForm((f) => ({ ...f, [key]: v }));
              setSaved(false);
            }}
            error={errors[key]}
            keyboardType="number-pad"
          />
        ))}
      </FieldRow>
      <Button title={saved ? 'Guardado ✓' : 'Guardar objetivos'} variant="secondary" loading={saving} onPress={save} />
    </View>
  );
}
