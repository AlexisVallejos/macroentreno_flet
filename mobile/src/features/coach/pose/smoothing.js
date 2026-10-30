// Los puntos de MediaPipe tiemblan unos píxeles aunque la persona esté quieta: el esqueleto vibra y los ángulos saltan.
// El filtro One Euro (Casiez et al., 2012) suaviza mucho cuando un punto está quieto y casi nada cuando se mueve
// rápido, así que saca el temblor sin quedarse atrás del movimiento real.

/** Hz: más bajo = más suave en reposo. */
const MIN_CUTOFF = 1.2;
/** Cuánto se abre el filtro con la velocidad (unidades de imagen por segundo). */
const BETA = 4;
const D_CUTOFF = 1;
/** La visibilidad es un promedio móvil: un cuadro dudoso no apaga una articulación. */
const VISIBILITY_ALPHA = 0.35;
/** Sin cuerpo por más de esto, se empieza de cero: probablemente es otra persona u otra posición. */
const RESET_AFTER_MS = 500;
/** Un salto así de grande en un cuadro no es movimiento sino una detección nueva: se toma tal cual. */
const TELEPORT = 0.25;

const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

function step(channel, raw, dt) {
  const speed = (raw - channel.value) / dt;
  channel.speed += alpha(D_CUTOFF, dt) * (speed - channel.speed);
  channel.value += alpha(MIN_CUTOFF + BETA * Math.abs(channel.speed), dt) * (raw - channel.value);
  return channel.value;
}

const fresh = (point) => ({
  x: { value: point.x, speed: 0 },
  y: { value: point.y, speed: 0 },
  z: { value: point.z ?? 0, speed: 0 },
  visibility: point.visibility ?? 1,
});

const read = (track) => ({ x: track.x.value, y: track.y.value, z: track.z.value, visibility: track.visibility });

/** Suaviza la pose cuadro a cuadro. `now` en milisegundos. */
export function createSmoother() {
  let tracks = [];
  let last = null;

  function reset() {
    tracks = [];
    last = null;
  }

  function smooth(lm, now) {
    if (!lm) {
      if (last !== null && now - last > RESET_AFTER_MS) reset();
      return null;
    }
    if (last === null || now - last > RESET_AFTER_MS || tracks.length !== lm.length) {
      tracks = lm.map(fresh);
      last = now;
      return tracks.map(read);
    }
    const dt = Math.max(1, now - last) / 1000;
    last = now;
    tracks = tracks.map((track, index) => {
      const point = lm[index];
      if (Math.hypot(point.x - track.x.value, point.y - track.y.value) > TELEPORT) return fresh(point);
      step(track.x, point.x, dt);
      step(track.y, point.y, dt);
      step(track.z, point.z ?? 0, dt);
      track.visibility += VISIBILITY_ALPHA * ((point.visibility ?? 1) - track.visibility);
      return track;
    });
    return tracks.map(read);
  }

  return { smooth, reset };
}
