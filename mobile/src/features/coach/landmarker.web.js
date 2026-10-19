// El analizador de postura (MediaPipe Pose Landmarker) corre en el navegador: el video no sale del dispositivo.
// Se carga como <script> clásico (expone el global `Vision`): Metro no puede empaquetar el import() dinámico que trae.

/** Copias locales que deja scripts/copy-mediapipe.js; si faltan, la misma versión desde la CDN. */
const LOCAL = '/mediapipe';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const REMOTE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';

/** `full` ve mejor las articulaciones (menos tobillos y muñecas adivinados); `lite` es para equipos que no dan abasto. */
const MODELS = {
  full: { local: '/models/pose_landmarker_full.task', remote: `${REMOTE}/pose_landmarker_full/float16/1/pose_landmarker_full.task` },
  lite: { local: '/models/pose_landmarker_lite.task', remote: `${REMOTE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task` },
};

let vision = null;
let filesets = null;
const loading = {};

/** El servidor de desarrollo contesta los archivos que faltan con HTML: eso cuenta como "no está". */
async function hasLocal(path) {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok && !(response.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

function script(src) {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = () => (window.Vision ? resolve(window.Vision) : reject(new Error('MediaPipe no expuso Vision')));
    tag.onerror = () => {
      tag.remove();
      reject(new Error(`No se pudo cargar ${src}`));
    };
    document.head.appendChild(tag);
  });
}

/** La librería de MediaPipe: { FilesetResolver, PoseLandmarker, … }. */
function loadVision() {
  vision ??= (async () => {
    if (window.Vision) return window.Vision;
    return (await hasLocal(`${LOCAL}/vision_bundle.js`)) ? script(`${LOCAL}/vision_bundle.js`).catch(() => script(`${CDN}/vision_bundle.js`)) : script(`${CDN}/vision_bundle.js`);
  })().catch((error) => {
    vision = null;
    throw error;
  });
  return vision;
}

async function fileset() {
  filesets ??= (async () => {
    const { FilesetResolver } = await loadVision();
    const local = await hasLocal(`${LOCAL}/wasm/vision_wasm_internal.wasm`);
    return FilesetResolver.forVisionTasks(local ? `${LOCAL}/wasm` : `${CDN}/wasm`);
  })().catch((error) => {
    filesets = null;
    throw error;
  });
  return filesets;
}

/** Prefiere la copia de public/models (funciona sin internet); si no, la de Google. */
async function modelPath(quality) {
  const { local, remote } = MODELS[quality];
  return (await hasLocal(local)) ? local : remote;
}

async function make(quality, delegate) {
  const { PoseLandmarker } = await loadVision();
  const landmarker = await PoseLandmarker.createFromOptions(await fileset(), {
    baseOptions: { modelAssetPath: await modelPath(quality), delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    // Un poco más exigente que lo normal al seguir un cuerpo: una sombra o una silla no se toman por una persona.
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.6,
  });
  return { landmarker, info: { quality, delegate } };
}

/** `full` solo tiene sentido con GPU; sin GPU, o sin internet para bajar el modelo completo, se usa `lite`. */
async function create(quality) {
  if (quality === 'full') {
    try {
      return await make('full', 'GPU');
    } catch {
      return loadLandmarker('lite');
    }
  }
  try {
    return await make('lite', 'GPU');
  } catch {
    return await make('lite', 'CPU');
  }
}

/** Un analizador compartido por calidad para toda la sesión; si falla la carga, se puede reintentar. */
export function loadLandmarker(quality = 'full') {
  loading[quality] ??= create(quality).catch((error) => {
    delete loading[quality];
    throw error;
  });
  return loading[quality];
}
