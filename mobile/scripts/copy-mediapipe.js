// Copia MediaPipe (el script del analizador y su runtime WASM) a public/ para que el análisis de postura (web)
// funcione sin CDN. Se carga con un <script> y no por Metro, que no acepta el import() dinámico que trae adentro.
// Corre solo después de `npm install`; si falta, la app lo baja de jsdelivr.
const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const pkg = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const out = join(root, 'public', 'mediapipe');

if (!existsSync(pkg)) {
  console.warn('Falta @mediapipe/tasks-vision: el entrenador con cámara va a usar la copia de la CDN.');
  process.exit(0);
}

cpSync(join(pkg, 'wasm'), join(out, 'wasm'), { recursive: true });
cpSync(join(pkg, 'vision_bundle.js'), join(out, 'vision_bundle.js'));
console.log('MediaPipe copiado a public/mediapipe');
