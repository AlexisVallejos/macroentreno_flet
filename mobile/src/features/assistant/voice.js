import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useCallback, useState } from 'react';

/**
 * Voz del asistente en el celular (expo-audio): grabar lo que dice el usuario y reproducir la
 * respuesta. La versión web está en voice.web.js.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Necesitamos permiso para usar el micrófono. Activalo en los ajustes del teléfono.');
    stopSpeech();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recorder]);

  /** Corta la grabación y devuelve el audio en base64 (m4a), o null si no se grabó nada. */
  const stop = useCallback(async () => {
    setRecording(false);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri) return null;
    const file = new File(recorder.uri);
    const audio = await file.base64();
    file.delete();
    return { audio, mimeType: 'audio/m4a' };
  }, [recorder]);

  return { recording, start, stop };
}

let player = null;

/** Reproduce el MP3 (base64) de la respuesta. Se guarda en caché porque Android no acepta data URLs. */
export async function playSpeech(base64) {
  stopSpeech();
  const file = new File(Paths.cache, 'asistente-respuesta.mp3');
  await file.write(base64, { encoding: 'base64' });
  player = createAudioPlayer({ uri: file.uri });
  player.play();
}

export function stopSpeech() {
  if (!player) return;
  player.pause();
  player.remove();
  player = null;
}
