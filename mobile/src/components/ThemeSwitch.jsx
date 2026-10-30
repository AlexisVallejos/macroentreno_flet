import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { colors, useTheme } from '../theme';
import { Chips } from './Chips';

const OPTIONS = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

/** Selector de apariencia: sigue al teléfono, o fuerza el modo claro u oscuro. */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return <Chips options={OPTIONS} value={preference} onChange={setPreference} scroll={false} />;
}

/** Botón de ícono para alternar claro/oscuro rápidamente (login y registro). */
export function ThemeToggleButton({ style }) {
  const { scheme, setPreference } = useTheme();
  const dark = scheme === 'dark';
  return (
    <Pressable
      onPress={() => setPreference(dark ? 'light' : 'dark')}
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      hitSlop={8}
      style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={24} color={colors.text} />
    </Pressable>
  );
}
