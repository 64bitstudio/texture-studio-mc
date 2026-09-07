import * as THREE from 'three';
import { applyBoxUV } from './geometry/applyBoxUV';
import { computeGeometryCenter } from './geometry/geometryBounds';
import type { MobBoxPart, MobGeometry } from './types/baseAssets';

const DEG_TO_RAD = Math.PI / 180;

// Ticket 062 (pedido de Marco, con imagen de referencia): la miniatura
// de cada mob en su tarjeta debe verse con el mismo ángulo "estilo
// wiki oficial" que ya usa `mobIcons.ts` -- perspectiva de 3/4, no la
// vista de frente plana que generaba `renderMobFrontSprite2D.ts`
// (ticket 055, retirado en este ticket). En vez de inventar una
// proyección isométrica a mano (matemática nueva, alto riesgo de no
// coincidir con la referencia), este módulo reutiliza el MISMO motor
// 3D que ya usa el editor en vivo (`Viewer3D.tsx`: misma geometría por
// cajas + UV clásico vía `applyBoxUV`, mismo ángulo de cámara inicial
// -- confirmado con Marco vía AskUserQuestion) para tomar UNA foto fija
// -- sin `OrbitControls`, sin escena persistente -- y devolverla como
// data URL, exactamente igual que el compositor 2D anterior devolvía
// la suya. Consumido por `useMobSnapshot3D.ts`.
//
// Mismo ángulo/FOV que el `<Canvas camera={{ position: [45, 40, 65],
// fov: 40 }}>` de `Viewer3D.tsx` -- es el ángulo con el que arranca el
// editor de CUALQUIER mob antes de tocar los controles orbitales, ya
// afinado a lo largo de varios tickets (048-052) contra imágenes de
// referencia para que se vea bien en los 4 mobs actuales. Reusarlo
// tal cual asegura consistencia visual entre "lo que ves si abres el
// editor" y "la miniatura de la tarjeta", sin duplicar el ajuste.
const CAMERA_POSITION: [number, number, number] = [45, 40, 65];
const CAMERA_FOV = 40;

// Ticket 065 (pedido de Marco: "los mobs deben verse mas grande...
// acerca mas los mobs"): el ángulo de `Viewer3D.tsx` de arriba está
// pensado para un visor INTERACTIVO (deja margen de sobra para poder
// rotar/hacer zoom sin que el modelo se salga de cuadro) -- para una
// miniatura fija ese margen solo deja al mob chico dentro del cuadro.
// `CAMERA_ZOOM` acerca la cámara hacia el centro de la geometría
// (nunca hacia el origen del mundo -- así funciona igual de bien para
// la Araña, cuyo bounding box está en otra posición/altura que la de
// un biped) MANTENIENDO exactamente el mismo ángulo de vista, solo
// reduce la distancia. Afinado en vivo contra los 4 mobs reales
// (Esqueleto/Zombie/Araña/Creeper) -- lo bastante cerca para que el
// mob llene la mayoría del cuadro sin recortar cabeza/pies.
const CAMERA_ZOOM = 0.75;

// Canvas WebGL + renderer COMPARTIDOS entre llamadas (módulo-level,
// creados una sola vez de forma perezosa): cada tarjeta de mob genera
// su propia miniatura, y crear un `WebGLRenderer` nuevo (= un contexto
// WebGL nuevo) por cada una agotaría el límite de contextos simultáneos
// que impone el navegador en un proyecto con muchos mobs. Un único
// renderer reutilizado en serie (JS es single-threaded -- no hay
// carrera entre llamadas) evita ese límite; lo que SÍ se libera después
// de cada llamada es la escena/geometría/textura de ESA llamada (ver
// el `finally` de `renderMobSnapshot3D`), no el renderer en sí.
let sharedRenderer: THREE.WebGLRenderer | null = null;

function getSharedRenderer(): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    const canvas = document.createElement('canvas');
    // `preserveDrawingBuffer: true` -- sin esto, `toDataURL` puede leer
    // un buffer ya limpiado por el navegador después del render (mismo
    // gotcha documentado para cualquier snapshot de un WebGLRenderer).
    // `alpha: true` + `setClearColor(..., 0)` en cada llamada -- fondo
    // transparente, igual que el compositor 2D anterior (el `<img>` que
    // lo consume ya pinta `background: var(--bg)` por CSS).
    sharedRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  }
  return sharedRenderer;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la textura para el preview 3D.'));
    img.src = dataUrl;
  });
}

/** Textura de canvas con los MISMOS sampler settings que `useCanvasTexture.ts` (pixel-art nítido, sin mipmaps, colorSpace sRGB explícito -- ver ese archivo para el porqué de cada uno, ticket 052). */
function createSnapshotTexture(img: HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('renderMobSnapshot3D.createSnapshotTexture: no se pudo crear el contexto 2D para decodificar la textura.');
    throw new Error('No se pudo preparar la textura para el preview 3D.');
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Una caja del modelo (cabeza/cuerpo/brazo/pierna/pata) -- misma lógica de posición/pivote-rotación que `MobPartMesh` en `Viewer3D.tsx`, reescrita en Three.js puro (sin react-three-fiber, este módulo no monta nada en el DOM de React). */
function buildPartMesh(part: MobBoxPart, textureWidth: number, textureHeight: number, material: THREE.Material): THREE.Object3D {
  const [w, h, d] = part.size;
  const geometry = new THREE.BoxGeometry(w, h, d);
  applyBoxUV(geometry, { u: part.uv.x, v: part.uv.y, w, h, d, mirrorX: part.mirrorX, textureWidth, textureHeight });

  if (!part.pivot) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(part.position[0], part.position[1], part.position[2]);
    return mesh;
  }

  const [px, py, pz] = part.pivot;
  const [rx = 0, ry = 0, rz = 0] = part.rotation ?? [0, 0, 0];
  const group = new THREE.Group();
  group.position.set(px, py, pz);
  group.rotation.set(rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(part.position[0] - px, part.position[1] - py, part.position[2] - pz);
  group.add(mesh);
  return group;
}

/** Libera SOLO los recursos GPU creados por esta llamada (geometrías/material/textura) -- nunca el renderer compartido, ver `getSharedRenderer`. */
function disposeSnapshotResources(root: THREE.Object3D, material: THREE.Material, texture: THREE.Texture): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.geometry.dispose();
  });
  material.dispose();
  texture.dispose();
}

/**
 * Genera una foto fija (data URL PNG) del mob con `texturePngDataUrl`
 * aplicada, en el mismo ángulo de cámara que `Viewer3D.tsx`. `outputSize`
 * es el lado del canvas cuadrado de salida en píxeles (por defecto 512,
 * suficiente para escalar hacia abajo tanto a la miniatura de la
 * tarjeta como al modal ampliado sin verse borroso).
 */
export async function renderMobSnapshot3D(geometry: MobGeometry, texturePngDataUrl: string, outputSize = 512): Promise<string> {
  const img = await loadImage(texturePngDataUrl);
  const texture = createSnapshotTexture(img);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false });

  const root = new THREE.Group();
  for (const part of Object.values(geometry.parts)) {
    root.add(buildPartMesh(part, geometry.textureWidth, geometry.textureHeight, material));
  }
  const scene = new THREE.Scene();
  scene.add(root);

  const target = computeGeometryCenter(geometry);
  // Acerca la cámara hacia `target` (nunca hacia el origen del mundo,
  // ver `CAMERA_ZOOM`) -- mismo ángulo de vista que `Viewer3D.tsx`,
  // solo más cerca.
  const cameraPosition: [number, number, number] = [
    target[0] + (CAMERA_POSITION[0] - target[0]) * CAMERA_ZOOM,
    target[1] + (CAMERA_POSITION[1] - target[1]) * CAMERA_ZOOM,
    target[2] + (CAMERA_POSITION[2] - target[2]) * CAMERA_ZOOM,
  ];
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
  camera.lookAt(target[0], target[1], target[2]);

  const renderer = getSharedRenderer();
  try {
    renderer.setSize(outputSize, outputSize, false);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    disposeSnapshotResources(root, material, texture);
  }
}
