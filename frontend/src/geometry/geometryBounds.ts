import type { MobBoxPart, MobGeometry } from '../types/baseAssets';
import { computeAbsolutePosition } from './hierarchy';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Rota un punto por los mismos angulos de Euler, mismo orden ('XYZ') y
 * misma formula que usa `Viewer3D.tsx` (via `THREE.Euler`/`<group
 * rotation>`) -- ver ticket 077 mas abajo. Formula copiada de
 * `Matrix4.makeRotationFromEuler` (three.js, orden 'XYZ') para no
 * depender de three.js en este archivo (deliberadamente puro, ver
 * comentario de `computeGeometryCenter`). Verificada por los tests
 * nuevos de `geometryBounds.spec.ts` reproduciendo el mismo resultado
 * que `Viewer3D.tsx` obtiene en pantalla para las patas de la Araña.
 */
function rotatePoint(point: [number, number, number], rotationDeg: [number, number, number]): [number, number, number] {
  const [x, y, z] = point;
  const [rx, ry, rz] = rotationDeg.map((d) => d * DEG_TO_RAD);
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  return [
    c * e * x + (-c * f) * y + d * z,
    (a * f + b * e * d) * x + (a * e - b * f * d) * y + -b * c * z,
    (b * f - a * e * d) * x + (b * e + a * f * d) * y + a * c * z,
  ];
}

/**
 * Las 8 esquinas de una caja del modelo, YA en espacio mundo -- para una
 * caja sin `pivot`/`rotation` son directamente `position ± size/2` (caso
 * de siempre, biped clasico); para una caja CON `pivot`/`rotation`
 * (ticket 024, patas de la Araña) hay que rotar la caja alrededor de su
 * pivote primero, igual que hace `Viewer3D.tsx` (`<group position={pivot}
 * rotation={...}><mesh position={position - pivot} /></group>`) -- usar
 * `position ± size/2` directo (sin rotar) para una caja rotada da un
 * bounding box equivocado, que fue el bug real del ticket 077 (ver mas
 * abajo).
 */
function boxCornersWorld(part: MobBoxPart): [number, number, number][] {
  const [w, h, d] = part.size;
  const halfExtents: [number, number, number][] = [
    [-w / 2, -h / 2, -d / 2],
    [-w / 2, -h / 2, d / 2],
    [-w / 2, h / 2, -d / 2],
    [-w / 2, h / 2, d / 2],
    [w / 2, -h / 2, -d / 2],
    [w / 2, -h / 2, d / 2],
    [w / 2, h / 2, -d / 2],
    [w / 2, h / 2, d / 2],
  ];

  if (!part.pivot) {
    return halfExtents.map(([ox, oy, oz]) => [part.position[0] + ox, part.position[1] + oy, part.position[2] + oz]);
  }

  const [px, py, pz] = part.pivot;
  const relativePosition: [number, number, number] = [part.position[0] - px, part.position[1] - py, part.position[2] - pz];
  const rotationDeg = part.rotation ?? [0, 0, 0];

  return halfExtents.map(([ox, oy, oz]) => {
    const local: [number, number, number] = [relativePosition[0] + ox, relativePosition[1] + oy, relativePosition[2] + oz];
    const rotated = rotatePoint(local, rotationDeg);
    return [px + rotated[0], py + rotated[1], pz + rotated[2]];
  });
}

/**
 * Las esquinas de TODAS las cajas del modelo (no solo las 8 del
 * bounding box exterior), en espacio mundo -- extraida de
 * `boxCornersWorld` para el piso de "no recortar nada" de
 * `computeMobCameraFraming` (ver punto 5 de ese comentario). Un cuerpo
 * con partes delgadas y separadas (ej. las 8 patas de la Araña, cada
 * una una caja fina apuntando en una direccion distinta) deja mucho
 * espacio VACIO dentro de su propio bounding box exterior -- proyectar
 * solo las 8 esquinas de ese bounding box (lo que hacia esta funcion
 * antes de esta ronda) sobrestima cuanto ocupa el modelo de VERDAD en
 * pantalla, alejando la camara mas de lo necesario (hallazgo real de
 * Marco: "aun se ve muy pequeña, ve todo el espacio que sobra").
 * Proyectar las esquinas de CADA caja por separado da el contorno real.
 */
export function computeAllPartCorners(geometry: MobGeometry): [number, number, number][] {
  const corners: [number, number, number][] = [];
  for (const [name, part] of Object.entries(geometry.parts)) {
    corners.push(...boxCornersWorld(worldSpacePart(geometry, name, part)));
  }
  return corners;
}

/**
 * Copia de `part` con `position` resuelta a espacio mundo (ticket 084)
 * -- una caja sin `parentId` ya es absoluta (`computeAbsolutePosition`
 * la devuelve tal cual, cero cambio para los 4 mobs vainilla ni ningun
 * otro consumidor existente); una caja CON `parentId` (jerarquia del
 * editor de modelo) resuelve su cadena completa de padres primero, para
 * que el bounding box/encuadre de camara no se calcule mal sobre una
 * posicion relativa como si fuera absoluta.
 */
function worldSpacePart(geometry: MobGeometry, name: string, part: MobBoxPart): MobBoxPart {
  if (!part.parentId) return part;
  return { ...part, position: computeAbsolutePosition(geometry, name) };
}

// Centro del bounding box 3D de un `MobGeometry` (ticket 020, hallazgo
// durante la implementacion de la Araña -- ver docs/ARQUITECTURA.md,
// "Ticket 020"). Antes de este ticket, `Viewer3D.tsx` apuntaba el
// `target` de `OrbitControls` a un valor fijo `[0, 16, 0]` -- correcto
// SOLO por coincidencia para el biped clasico (Esqueleto/Zombie), cuyo
// bounding box real (pies en y=0, cabeza hasta y=32) tiene centro
// exactamente en y=16. La Araña, mucho mas pequeña y centrada en otra
// altura/profundidad (cuerpo en y=5..13, z=-11..15), quedaria mirando a
// un punto muy alejado de su propio modelo con ese valor fijo.
//
// TICKET 077 (pedido de Marco: "el modelo 3D de la araña esta mal",
// comparado contra `assets/mob-icons/spider.png`, la MISMA imagen de
// referencia que se ve junto al visor 3D en "Nuevo proyecto"). Geometria
// de las patas verificada de nuevo pixel/angulo a angulo contra
// `Mojang/bedrock-samples` (fetch real, ver `spiderGeometry.ts` en el
// backend) -- posiciones/pivotes/rotaciones de las 8 patas coinciden
// EXACTO con la fuente oficial, sin ninguna asimetria entre lado
// izquierdo/derecho (verificado programaticamente, no a ojo). El bug
// real no estaba ahi: esta funcion calculaba el bounding box de las
// patas usando su `position`/`size` SIN ROTAR -- para una pata sin
// `pivot` eso es todo lo que hay, pero las patas de la Araña SI tienen
// `pivot`/`rotation` (apuntan hacia abajo, tocando el piso) y su caja
// real ocupa una zona bien distinta de la que predice `position ±
// size/2` sin rotar. Consecuencia visible: el `target` de
// `OrbitControls` (este valor) quedaba mas alto y mas angosto que el
// contorno real del modelo, y la camara fija de `Viewer3D.tsx` (mismo
// vector para los 4 mobs) terminaba enmarcando la Araña con las patas
// del lado lejano recortadas/escondidas detras del cuerpo -- se leia
// como "le faltan patas" al comparar contra la referencia, aunque las 8
// patas SI estaban ahi (confirmado rotando la camara a mano en vivo).
// `boxCornersWorld` (arriba) corrige esto calculando las 8 esquinas
// reales de cada caja, rotadas si corresponde, antes de tomar el
// min/max -- para un mob sin ninguna pata con `pivot` (Esqueleto/Zombie/
// Creeper, los otros 3 consumidores) el resultado es IDENTICO al de
// antes (mismos tests ya existentes en verde, sin cambiar valores
// esperados), porque `boxCornersWorld` cae en la misma rama sin rotar
// que ya usaba esta funcion.
//
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `symmetry.ts`/`regionLabels.ts` (ver
// `frontend/test/geometryBounds.spec.ts`). Verificado que para
// SKELETON_GEOMETRY/ZOMBIE_GEOMETRY esta funcion devuelve exactamente
// `[0, 16, 0]` -- mismo resultado que el valor fijo anterior, sin
// regresion visual para los mobs ya existentes.
export interface GeometryBounds {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Bounding box 3D completo (min/max por eje) de un `MobGeometry`, en
 * espacio mundo y YA rotado para las cajas con `pivot`/`rotation` (ver
 * `boxCornersWorld` arriba). Extraido de `computeGeometryCenter` en el
 * ticket 077 para que `Viewer3D.tsx` tambien pueda derivar el "tamaño"
 * real del modelo (no solo su centro) y adaptar la elevacion de la
 * camara inicial a la forma de cada mob -- ver ese ticket en
 * `docs/ARQUITECTURA.md` para el porque.
 */
export function computeGeometryBounds(geometry: MobGeometry): GeometryBounds | null {
  const entries = Object.entries(geometry.parts);
  if (entries.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [name, part] of entries) {
    for (const [x, y, z] of boxCornersWorld(worldSpacePart(geometry, name, part))) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function computeGeometryCenter(geometry: MobGeometry): [number, number, number] {
  const bounds = computeGeometryBounds(geometry);
  if (!bounds) return [0, 0, 0];
  const { min, max } = bounds;
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

// Encuadre de referencia (ticket 077): mismo "de que lado" (azimut) y
// misma distancia total a la camara que el vector fijo original
// `[45, 40, 65]` que uso `Viewer3D.tsx` hasta el ticket 077 (afinado a
// ojo para el biped clasico, tickets 048-052) -- solo la ELEVACION pasa
// a derivarse del aspect ratio real de cada mob (ver `computeMobCameraFraming`).
const REFERENCE_AZIMUTH = Math.atan2(45, 65);
const REFERENCE_DISTANCE = Math.hypot(45, 40, 65);
const REFERENCE_ELEVATION = Math.asin(40 / REFERENCE_DISTANCE);

/**
 * FOV vertical (grados) que usan TANTO `<Canvas camera={{fov: ...}}>`
 * en `Viewer3D.tsx` COMO `new THREE.PerspectiveCamera(...)` en
 * `renderMobSnapshot3D.ts` -- unica fuente de verdad para que el
 * calculo de "no recortar nada" (`MIN_VISIBLE_MARGIN` mas abajo) use el
 * mismo angulo que la camara real. Si algun dia un consumidor necesita
 * un FOV distinto, este valor pasa a ser un parametro de
 * `computeMobCameraFraming` en vez de una constante -- hoy los 2
 * consumidores coinciden, asi que una constante compartida evita que
 * se desincronicen sin agregar una API mas compleja de la necesaria.
 */
export const CAMERA_FOV_DEG = 40;

export interface MobCameraFraming {
  target: [number, number, number];
  cameraPosition: [number, number, number];
}

/**
 * Encuadre de camara completo (a donde mira -- `target` -- y desde
 * donde -- `cameraPosition`) para CUALQUIER `MobGeometry`, derivado de
 * su forma real (nunca del nombre del mob). Unica fuente de verdad,
 * compartida por `Viewer3D.tsx` (visor interactivo) y
 * `renderMobSnapshot3D.ts` (miniatura fija de las tarjetas) -- ambos
 * consumian formulas separadas hasta el ticket 077 y se fueron
 * desincronizando cada vez que se afinaba una sin tocar la otra (bug
 * real reportado por Marco: la miniatura de la tarjeta seguia
 * mostrando a la Araña "volteada" despues de corregir el visor). Ahora
 * un cambio aca se refleja automaticamente en los dos lugares.
 *
 * Ticket 077, resumen de las 6 rondas que llevaron a esta formula
 * (detalle completo en `docs/ARQUITECTURA.md`, "Ticket 077"):
 * 1. `target` en (x,z) toma la posicion de la parte `head` cuando
 *    existe (los 4 mobs actuales la tienen), no el centro de TODO el
 *    bounding box -- para un cuerpo largo en profundidad (cabeza lejos
 *    del abdomen, ej. Araña) el centro completo queda sesgado hacia la
 *    parte mas grande (el abdomen), relegando la cara a una esquina.
 *    El eje Y sigue tomando el bounding box completo (no solo la
 *    cabeza) para no cortar piernas/patas por abajo del encuadre. Para
 *    un biped esto es un NO-OP exacto: la cabeza ya esta centrada en
 *    x=0,z=0, igual que el bounding box completo.
 * 2. La ELEVACION (angulo sobre el horizonte) se deriva del aspect
 *    ratio real del bounding box (radio horizontal vs. radio vertical)
 *    -- mas alta para cuerpos bajos y anchos (para separar patas
 *    izquierda/derecha que de otro modo se ocultan una detras de la
 *    otra), mezclada solo 15% con el angulo de referencia del biped
 *    (100% se veia demasiado cenital, inclinaba todo el cuerpo en
 *    diagonal dentro del encuadre en vez de mostrar cabeza y abdomen a
 *    la misma altura).
 * 3. La DISTANCIA se reduce (`distanceScale`) cuando la cabeza esta
 *    lejos del centro geometrico completo (mismo proxy de "cuerpo
 *    alargado hacia atras") -- acerca la camara a la cabeza para que
 *    gane protagonismo por perspectiva sobre el resto del cuerpo, como
 *    un retrato real.
 * 4. `frontSign` invierte el sesgo de la camara en X y Z cuando la
 *    propia cabeza declara `swapFrontBack` (ver `applyBoxUV.ts`) --
 *    sin esto la camara se acercaba del lado de la NUCA en vez de la
 *    cara para cualquier mob con la cara/nuca invertidas.
 * 5. La distancia final NUNCA puede ser menor que la necesaria para
 *    que TODO el bounding box (no solo la cabeza) quepa dentro del
 *    cono de vision de la camara (`CAMERA_FOV_DEG`) -- sin este piso,
 *    `distanceScale` (punto 3) podia acercar tanto la camara que una
 *    parte del cuerpo lejos de la cabeza (ej. el abdomen de la Araña)
 *    quedaba fuera de cuadro en la miniatura fija de
 *    `renderMobSnapshot3D.ts` (bug real reportado por Marco con una
 *    captura: "sale incluso incompleta" -- a diferencia del visor
 *    interactivo, una miniatura recortada no se puede "arreglar"
 *    alejando el zoom a mano). Se proyectan las esquinas de CADA CAJA
 *    del modelo por separado (`computeAllPartCorners`, no las 8
 *    esquinas del bounding box EXTERIOR -- ver ese comentario: un
 *    cuerpo de partes delgadas y separadas, ej. las 8 patas de la
 *    Araña, deja mucho espacio vacio dentro de su propio bounding box
 *    exterior, asi que bordear ESE rectangulo exagera cuanto ocupa el
 *    modelo de verdad en pantalla -- segundo hallazgo real de Marco,
 *    con captura, tras el primer ajuste: "aun se ve muy pequeña") sobre
 *    los ejes horizontal/vertical DE LA CAMARA (no una esfera
 *    envolvente omnidireccional -- primer intento de este mismo punto,
 *    exageraba aun mas la distancia para un cuerpo alargado hacia la
 *    profundidad) y se exige `distancia >= max(desplazamiento
 *    horizontal, vertical) / tan(FOV/2) * margen` -- si `distanceScale`
 *    ya pedia mas distancia que eso, no cambia nada (biped clasico,
 *    esquinas chicas respecto a la distancia de referencia); si pedia
 *    menos, este piso gana.
 *
 * Todos los ajustes son funciones de la FORMA/DATOS de la geometria
 * (bounding box, posicion de `head`, flag `swapFrontBack`) -- ningun
 * `if` nombra a ningun mob. Para Esqueleto/Zombie/Creeper (altos,
 * angostos, cabeza centrada, sin `swapFrontBack`) el resultado es
 * identico al vector fijo original, verificado en vivo repetidas veces
 * a lo largo de las 6 rondas.
 *
 * `cameraZoom` escala la distancia camara-target (nunca camara-origen,
 * para que funcione igual con la Araña, cuyo bounding box no esta
 * centrado en el origen) -- `1` = mismo encuadre de siempre, `<1`
 * acerca la camara, SALVO que el piso del punto 5 (nunca recortar el
 * modelo) exija mas distancia -- en ese caso gana el piso. Cada
 * consumidor pasa su propio valor (`Viewer3D.tsx` por defecto `1`,
 * `Editor.tsx` le pasa `0.65`, `renderMobSnapshot3D.ts` usa `0.75` para
 * que el mob llene la miniatura).
 */
export function computeMobCameraFraming(geometry: MobGeometry, cameraZoom: number): MobCameraFraming {
  const bounds = computeGeometryBounds(geometry);
  const center = computeGeometryCenter(geometry);
  const head = geometry.parts.head;
  const target: [number, number, number] = head ? [head.position[0], center[1], head.position[2]] : center;

  let elevation = REFERENCE_ELEVATION;
  let distanceScale = 1;

  if (bounds) {
    const halfY = (bounds.max[1] - bounds.min[1]) / 2;
    const halfX = (bounds.max[0] - bounds.min[0]) / 2;
    const halfZ = (bounds.max[2] - bounds.min[2]) / 2;
    const halfHoriz = Math.max(halfX, halfZ);
    if (halfHoriz > 0) {
      const aspectElevation = Math.atan2(halfHoriz, Math.max(halfY, 0.001));
      elevation = REFERENCE_ELEVATION + 0.15 * (aspectElevation - REFERENCE_ELEVATION);
    }

    const centerX = (bounds.min[0] + bounds.max[0]) / 2;
    const centerZ = (bounds.min[2] + bounds.max[2]) / 2;
    const headOffset = Math.hypot(target[0] - centerX, target[2] - centerZ);
    if (headOffset > 0) {
      distanceScale = REFERENCE_DISTANCE / (REFERENCE_DISTANCE + headOffset * 4);
    }
  }

  const frontSign = head?.swapFrontBack ? -1 : 1;

  // La distancia final real (target -> camara) es `REFERENCE_DISTANCE *
  // distanceScale * cameraZoom` -- ver punto 5 del comentario de
  // arriba. Se calcula ANTES de armar `offset` (en vez de escalar el
  // offset por `cameraZoom` al final, como antes del ticket 077) para
  // poder aplicarle un piso: nunca puede ser menor que la distancia
  // minima que evita recortar el bounding box completo dentro del cono
  // de vision de la camara.
  let distance = REFERENCE_DISTANCE * distanceScale * cameraZoom;

  if (bounds) {
    // Direccion camara->target (unitaria): exactamente la misma que
    // arma `offset` mas abajo (mismo `elevation`/`REFERENCE_AZIMUTH`/
    // `frontSign`), extraida antes de conocer `distance` para poder usarla
    // aca. `forward` = target->camera invertido = camara->target.
    const dirX = frontSign * Math.cos(elevation) * Math.sin(REFERENCE_AZIMUTH);
    const dirY = Math.sin(elevation);
    const dirZ = frontSign * Math.cos(elevation) * Math.cos(REFERENCE_AZIMUTH);
    const forward: [number, number, number] = [-dirX, -dirY, -dirZ];

    // Base ortonormal de la camara (right/up), igual que
    // `camera.lookAt` -- `right = forward x worldUp`, `up = right x
    // forward`. `worldUp` fijo en +Y es seguro aca: `elevation` nunca
    // llega a 90° (mirar derecho hacia abajo/arriba), ver el 15% de
    // mezcla mas arriba.
    const worldUp: [number, number, number] = [0, 1, 0];
    let right: [number, number, number] = [
      forward[1] * worldUp[2] - forward[2] * worldUp[1],
      forward[2] * worldUp[0] - forward[0] * worldUp[2],
      forward[0] * worldUp[1] - forward[1] * worldUp[0],
    ];
    const rightLen = Math.hypot(right[0], right[1], right[2]) || 1;
    right = [right[0] / rightLen, right[1] / rightLen, right[2] / rightLen];
    const up: [number, number, number] = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];

    // Para cada esquina de CADA CAJA del modelo (no las 8 esquinas del
    // bounding box exterior -- ver `computeAllPartCorners`, ronda
    // siguiente de este mismo ticket: un cuerpo con partes delgadas y
    // separadas, ej. las 8 patas de la Araña, deja mucho espacio VACIO
    // dentro de su propio bounding box exterior, y bordear ESE
    // rectangulo exagera cuanto ocupa el modelo de verdad en pantalla),
    // su desplazamiento lateral/vertical en PANTALLA (proyectado sobre
    // `right`/`up`) -- aproximando que la esquina esta a la misma
    // profundidad que `target` (valido: el radio del cuerpo es chico
    // frente a la distancia de camara). El MAYOR desplazamiento en
    // cualquiera de los 2 ejes, en cualquier esquina, es lo que de
    // verdad puede salirse del cuadro.
    let maxRight = 0;
    let maxUp = 0;
    const corners = computeAllPartCorners(geometry);
    for (const corner of corners) {
      const rel: [number, number, number] = [corner[0] - target[0], corner[1] - target[1], corner[2] - target[2]];
      const rightComponent = Math.abs(rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]);
      const upComponent = Math.abs(rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2]);
      maxRight = Math.max(maxRight, rightComponent);
      maxUp = Math.max(maxUp, upComponent);
    }

    const halfFovRad = (CAMERA_FOV_DEG / 2) * DEG_TO_RAD;
    // El canvas de la miniatura es cuadrado (`renderMobSnapshot3D.ts`)
    // -- FOV horizontal = FOV vertical con aspecto 1:1, asi que el mismo
    // angulo sirve para `maxRight` y `maxUp`. El visor interactivo
    // (`Viewer3D.tsx`) puede ser mas ancho que alto -- usar el mismo
    // angulo vertical para ambos ahi es conservador (nunca recorta),
    // nunca al reves. 6% de margen (`1.06`) -- solo para que el modelo
    // no quede tocando el borde exacto del cuadro.
    const minSafeDistance = (Math.max(maxRight, maxUp) / Math.tan(halfFovRad)) * 1.06;
    distance = Math.max(distance, minSafeDistance);
  }

  const horizontalDistance = distance * Math.cos(elevation);
  const offset: [number, number, number] = [
    frontSign * horizontalDistance * Math.sin(REFERENCE_AZIMUTH),
    distance * Math.sin(elevation),
    frontSign * horizontalDistance * Math.cos(REFERENCE_AZIMUTH),
  ];

  const cameraPosition: [number, number, number] = [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]];

  return { target, cameraPosition };
}
