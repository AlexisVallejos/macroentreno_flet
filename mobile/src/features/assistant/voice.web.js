import { useCallback, useRef, useState } from 'react';

/**
 * Voz del asistente en el navegador: MediaRecorder para grabar y un <audio> para la respuesta.
 * El navegador pide permiso de micrófono la primera vez (solo funciona en https o localhost).
 */
export function useVoiceRecorder() {
  const media = useRef(null);
  const chunks = useRef([]);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Este navegador no permite grabar audio. Probá con Chrome, Edge o Safari actualizados.');
    }
    stopSpeech();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('Necesitamos permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones.');
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.start();
    media.current = recorder;
    setRecording(true);
  }, []);

  /** Corta la grabación y devuelve el audio en base64, o null si no se grabó nada. */
  const stop = useCallback(() => {
    const recorder = media.current;
    setRecording(false);
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        media.current = null;
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return resolve(null);
        const buffer = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
        resolve({ audio: btoa(binary), mimeType: blob.type });
      };
      recorder.stop();
    });
  }, []);

  return { recording, start, stop };
}

let audio = null;

export async function playSpeech(base64) {
  stopSpeech();
  audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  await audio.play().catch(() => {}); // si el navegador bloquea el autoplay, la respuesta igual queda escrita
}

export function stopSpeech() {
  audio?.pause();
  audio = null;
}
