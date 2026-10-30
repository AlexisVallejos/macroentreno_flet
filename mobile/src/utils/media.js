import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** ~6 MB de imagen: el servidor rechaza más (las fotos viajan en base64). */
const MAX_DATA_URL = 9 * 1024 * 1024;

/**
 * Saca una foto o la elige de la galería y la devuelve como data URL lista para la IA.
 * null si el usuario cancela. Lanza un Error con mensaje en castellano si falta el permiso.
 */
export async function pickImage(source = 'camera') {
  const useCamera = source === 'camera' && Platform.OS !== 'web';
  if (useCamera) {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Necesitamos permiso para usar la cámara. Activalo en los ajustes del teléfono.');
  }
  const options = { mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: false, exif: false };
  const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const dataUrl = asset.uri?.startsWith('data:') ? asset.uri : `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  if (dataUrl.length > MAX_DATA_URL) throw new Error('La foto es muy pesada. Probá con otra o sacala de más cerca.');
  return dataUrl;
}
