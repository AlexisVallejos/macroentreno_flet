import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Paletas basadas en los colores de sistema de iOS (Human Interface Guidelines), en modo
 * oscuro y claro, con el verde como color de acento al estilo de Fitness/Salud.
 */
export const palettes = {
  dark: {
    background: '#000000', // systemBackground
    card: '#1C1C1E', // secondarySystemBackground
    cardAlt: '#2C2C2E', // tertiarySystemBackground
    fill: 'rgba(118,118,128,0.24)', // tertiarySystemFill: inputs, pistas de las barras
    border: '#38383A', // separator opaco
    primary: '#30D158', // systemGreen
    primarySoft: 'rgba(48,209,88,0.16)',
    primaryMuted: 'rgba(48,209,88,0.38)',
    onPrimary: '#000000', // texto sobre el verde (contraste AA)
    secondary: '#64D2FF',
    text: '#FFFFFF',
    muted: '#8E8E93', // systemGray
    chevron: 'rgba(235,235,245,0.3)',
    tabBar: 'rgba(18,18,18,0.94)',
    danger: '#FF453A',
    dangerSoft: 'rgba(255,69,58,0.14)',
    success: '#30D158',
    warning: '#FF9F0A',
    protein: '#BF5AF2', // systemPurple
    carbs: '#64D2FF', // systemCyan
    fat: '#FFD60A', // systemYellow
    kcal: '#30D158',
  },
  light: {
    background: '#F2F2F7', // systemGroupedBackground
    card: '#FFFFFF',
    cardAlt: '#E5E5EA',
    fill: 'rgba(118,118,128,0.12)',
    border: '#C6C6C8',
    primary: '#248A3D', // systemGreen oscurecido para tener contraste sobre fondo claro
    primarySoft: 'rgba(36,138,61,0.12)',
    primaryMuted: 'rgba(36,138,61,0.38)',
    onPrimary: '#FFFFFF',
    secondary: '#0071A4',
    text: '#000000',
    muted: '#6C6C70',
    chevron: 'rgba(60,60,67,0.3)',
    tabBar: 'rgba(249,249,249,0.94)',
    danger: '#D70015',
    dangerSoft: 'rgba(215,0,21,0.10)',
    success: '#248A3D',
    warning: '#B25000',
    protein: '#8944AB',
    carbs: '#0071A4',
    fat: '#A05A00',
    kcal: '#248A3D',
  },
};

let current = 'dark';

/**
 * Colores del tema activo. Es un objeto con getters: cada lectura devuelve el valor del tema
 * vigente, así `colors.text` sigue funcionando igual en cualquier archivo.
 */
export const colors = {};
for (const key of Object.keys(palettes.dark)) {
  Object.defineProperty(colors, key, { enumerable: true, get: () => palettes[current][key] });
}

/**
 * Como StyleSheet.create pero re-evaluado al cambiar el tema. Devuelve un objeto que se usa
 * igual (`styles.card`); los estilos se recalculan una sola vez por tema.
 */
export function createStyles(factory) {
  const cache = {};
  const get = () => (cache[current] ??= factory());
  return new Proxy({}, { get: (_, prop) => get()[prop], has: (_, prop) => prop in get(), ownKeys: () => Reflect.ownKeys(get()) });
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };

/** Escala tipográfica de iOS: caption, footnote, subheadline, body, title2, title1, large title. */
export const font = { xs: 12, sm: 13, md: 15, body: 17, lg: 17, xl: 22, xxl: 28, display: 34 };

/** Tracking negativo para textos grandes: las letras se ven separadas a medida que crecen. */
export const tracking = { display: -0.6, title: -0.4, headline: -0.2 };

/** Números con ancho fijo para que no "bailen" al cambiar, en la variante redondeada si existe. */
export const numeric = {
  fontVariant: ['tabular-nums'],
  ...(Platform.OS === 'web' ? { fontFamily: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif' } : null),
};

/** Esquinas continuas (squircle) en iOS, como las de los íconos y tarjetas del sistema. */
export const continuous = Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null;

/** Ancho máximo del contenido en tablets / horizontal, para que no quede estirado. */
export const MAX_CONTENT_WIDTH = 760;

/* ---------------------------------- Tema activo ---------------------------------- */

const THEME_KEY = 'macroentreno.theme';
const store = Platform.OS === 'web'
  ? {
      getItemAsync: async (k) => globalThis.localStorage?.getItem(k) ?? null,
      setItemAsync: async (k, v) => globalThis.localStorage?.setItem(k, v),
    }
  : SecureStore;

const ThemeContext = createContext({ scheme: 'dark', preference: 'system', setPreference: () => {} });

/**
 * Preferencia del usuario: 'system' (sigue al teléfono), 'light' u 'dark'. Se guarda en el
 * dispositivo. Cada componente que llama a useTheme() se vuelve a dibujar al cambiar.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('system');
  const [system, setSystem] = useState(Appearance.getColorScheme() ?? 'dark');

  useEffect(() => {
    store.getItemAsync(THEME_KEY).then((v) => v && setPreferenceState(v)).catch(() => {});
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme ?? 'dark'));
    return () => sub.remove();
  }, []);

  const scheme = preference === 'system' ? system : preference;
  current = scheme; // eslint-disable-line react-hooks/globals -- se asigna durante el render para que los hijos lean ya el tema nuevo

  const setPreference = useCallback((value) => {
    setPreferenceState(value);
    store.setItemAsync(THEME_KEY, value).catch(() => {});
  }, []);

  const value = useMemo(() => ({ scheme, preference, setPreference }), [scheme, preference, setPreference]);
  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = () => useContext(ThemeContext);
