import { Image } from 'react-native';
import { useTheme } from '../theme';

const WHITE = require('../../assets/logo-white.png');
const BLACK = require('../../assets/logo-black.png');

/** Logo de MacroEntreno: blanco sobre el tema oscuro y negro sobre el claro. */
export function Logo({ size = 96, style }) {
  const { scheme } = useTheme();
  return (
    <Image
      source={scheme === 'dark' ? WHITE : BLACK}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Logo de MacroEntreno"
    />
  );
}
