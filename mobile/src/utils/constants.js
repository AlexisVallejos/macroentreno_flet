export const ROLES = {
  admin: { label: 'Administrador', color: '#FF453A', icon: 'shield-checkmark' },
  coach: { label: 'Entrenador', color: '#FF9F0A', icon: 'stopwatch' },
  athlete: { label: 'Atleta', color: '#34C759', icon: 'barbell' },
};

export const MEALS = [
  { key: 'desayuno', label: 'Desayuno', icon: 'cafe-outline' },
  { key: 'almuerzo', label: 'Almuerzo', icon: 'restaurant-outline' },
  { key: 'merienda', label: 'Merienda', icon: 'ice-cream-outline' },
  { key: 'cena', label: 'Cena', icon: 'moon-outline' },
  { key: 'snack', label: 'Snack', icon: 'nutrition-outline' },
];

export const mealLabel = (key) => MEALS.find((m) => m.key === key)?.label ?? key;
