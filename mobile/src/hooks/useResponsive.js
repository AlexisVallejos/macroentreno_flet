import { useWindowDimensions } from 'react-native';

/** Datos de la pantalla para adaptar el layout a tamaño y orientación. */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;
  // Columnas para grillas de tarjetas
  const columns = width >= 900 ? 3 : width >= 560 || isLandscape ? 2 : 1;
  return { width, height, isLandscape, isTablet, columns };
}
