import { Platform } from 'react-native';

/**
 * Paleta y medidas compartidas, basadas en los colores de sistema de iOS en modo oscuro
 * (Human Interface Guidelines) con el verde como color de acento, al estilo de Fitness/Salud.
 */
export const colors = {
  background: '#000000', // systemBackground
  card: '#1C1C1E', // secondarySystemBackground
  cardAlt: '#2C2C2E', // tertiarySystemBackground
  fill: 'rgba(118,118,128,0.24)', // tertiarySystemFill: inputs, pistas de las barras
  border: '#38383A', // separator opaco
  primary: '#30D158', // systemGreen
  primarySoft: 'rgba(48,209,88,0.16)',
  onPrimary: '#000000', // texto sobre el verde (contraste AA)
  secondary: '#64D2FF',
  text: '#FFFFFF',
  muted: '#8E8E93', // systemGray
  danger: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
  protein: '#BF5AF2', // systemPurple
  carbs: '#64D2FF', // systemCyan
  fat: '#FFD60A', // systemYellow
  kcal: '#30D158',
};

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
