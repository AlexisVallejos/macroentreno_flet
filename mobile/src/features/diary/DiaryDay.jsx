import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ListItem, MacroInline, MacroSummary } from '../../components';
import { colors, font, spacing } from '../../theme';
import { MEALS } from '../../utils/constants';
import { fmt } from '../../utils/format';

/**
 * Día del diario agrupado por comida. Se usa en la pestaña del atleta (editable)
 * y en el detalle de atleta del coach (solo lectura).
 */
export function DiaryDay({ day, onAdd, onEdit, onDelete, readOnly = false }) {
  const byMeal = MEALS.map((meal) => ({ ...meal, entries: day.entries.filter((e) => e.meal === meal.key) }));
  const visible = readOnly ? byMeal.filter((m) => m.entries.length) : byMeal;

  return (
    <>
      <Card>
        <MacroSummary totals={day.totals} goals={day.goals} />
      </Card>
      {readOnly && !day.entries.length ? (
        <EmptyState icon="restaurant-outline" title="Sin registros" message="No cargó comidas este día." />
      ) : null}
      {visible.map((meal) => {
        const kcal = meal.entries.reduce((acc, e) => acc + e.kcal, 0);
        return (
          <Card
            key={meal.key}
            title={meal.label}
            right={
              <View style={styles.mealRight}>
                <Text style={styles.mealKcal}>{fmt(kcal)} kcal</Text>
                {!readOnly ? (
                  <Pressable
                    onPress={() => onAdd(meal.key)}
                    hitSlop={8}
                    accessibilityLabel={`Agregar a ${meal.label}`}
                    style={styles.add}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            }
          >
            {meal.entries.length === 0 ? <Text style={styles.empty}>Todavía no registraste nada.</Text> : null}
            {meal.entries.map((entry) => (
              <ListItem
                key={entry.id}
                icon={meal.icon}
                title={`${entry.name} · ${fmt(entry.grams)} g`}
                subtitle={<MacroInline {...entry} />}
                onPress={readOnly ? undefined : () => onEdit(entry)}
                right={
                  readOnly ? null : (
                    <Pressable onPress={() => onDelete(entry)} hitSlop={10} accessibilityLabel={`Eliminar ${entry.name}`}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  )
                }
              />
            ))}
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mealKcal: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
  add: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: font.sm },
});
