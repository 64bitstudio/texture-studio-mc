import type { FaceLabels, MobGeometry } from '../types/baseAssets.js';

// Geometria del Creeper (ticket 021, ver
// docs/definiciones/multi-mob-y-proyectos-guardados.md y
// `pending/021-geometria-creeper.md`, "Metodologia obligatoria"). A
// diferencia de Zombie/Araña, su asset vanilla real NO estaba cacheado
// todavia -- se extrajo primero (ver paso 0 abajo) antes de poder hacer
// la verificacion empirica del paso 2, siguiendo la regla explicita del
// ticket de NUNCA aproximar/asumir la textura si la extraccion estuviera
// bloqueada.
//
// 0) EXTRACCION del asset vanilla real: `creeper.png` no existia en
//    `~/tools/minecraft-texture-pack/vanilla-cache/` -- se extrajo
//    legitimamente del client `.jar` YA INSTALADO en esta Mac
//    (`~/Library/Application Support/minecraft/versions/1.21.11/
//    1.21.11.jar`, mismo mecanismo ya usado para Esqueleto/Zombie/Araña,
//    ruta `assets/minecraft/textures/entity/creeper/creeper.png` dentro
//    del jar) y cacheado en la misma carpeta para reuso futuro.
//
// 1) FUENTE OFICIAL -- fetch real de
//    `Mojang/bedrock-samples/resource_pack/models/entity/creeper.geo.json`
//    (rama `main`). `texturewidth`/`textureheight` declarados: 64x32,
//    igual al PNG real extraido en el paso 0 (sin mitad extra sin usar,
//    a diferencia del Zombie). Bones (unidades = pixeles de textura;
//    `origin` = esquina inferior de la caja, convertida a `position` =
//    centro sumando `size/2` -- ninguno de estos bones tiene `rotation`,
//    mismo criterio que Esqueleto/Zombie/Araña):
//      - "body": origin [-4,6,-2], size [8,12,4], uv [16,16]
//        -> position [0,12,0]
//      - "head" (hijo de "body", pero sin rotation -- `origin` ya es
//        absoluto): origin [-4,18,-4], size [8,8,8], uv [0,0]
//        -> position [0,22,0]
//      - "leg0".."leg3" (4 patas, TODAS size [4,6,4] Y el MISMO
//        uv [0,16] -- el Creeper vanilla reusa una unica region UV para
//        las 4 patas, igual criterio que las 8 patas de la Araña; A
//        DIFERENCIA de la Araña, NINGUNA declara `mirror` en el
//        .geo.json oficial -- se preserva tal cual, sin inventar un
//        mirror "por simetria" que la fuente no tiene):
//          leg0: origin [-4,0,2],  -> position [-2,3,4]  (frente-derecha)
//          leg1: origin [0,0,2],   -> position [2,3,4]   (frente-izquierda)
//          leg2: origin [-4,0,-6], -> position [-2,3,-4] (atras-derecha)
//          leg3: origin [0,0,-6],  -> position [2,3,-4]  (atras-izquierda)
//        ("derecha"/"izquierda" = lado anatomico del personaje, mismo
//        criterio que armRight/legRight del biped: x negativo = derecho)
//
// 2) VERIFICACION EMPIRICA pixel a pixel contra el `creeper.png` real
//    extraido en el paso 0. Mapa de luminancia/alpha por fila/columna
//    (mismo metodo que Zombie/Araña), cruzado contra el rectangulo UV
//    "cross" que predice cada caja de arriba:
//      - Filas 0-7: opaco SOLO en columnas 8-23 (16 columnas = cross
//        top+bottom de la cabeza, `2*w=16` con `w=8` ✓); columnas 0-7 y
//        24+ transparentes en estas filas -- confirma que right/front/
//        left/back de la cabeza (columnas 0-31) todavia no empiezan.
//      - Filas 8-15: opaco continuo en columnas 0-31 (right+front+left+
//        back de la cabeza concatenadas, `8*4=32` ✓).
//      - Fila 16: opaco SOLO en columnas 4-11 (8 columnas = cross
//        top+bottom de una pata, `2*w=8` con `w=4` ✓) -- confirma
//        `size.x = size.z = 4` de las patas (no un valor mayor).
//      - Fila 20: opaco continuo de columna 0 a ~35 (right+front+left+
//        back de las patas, columnas 0-15, seguido sin hueco por
//        right+front+left+back del cuerpo, columnas 16-35) -- confirma
//        que ambas cajas coexisten en esa fila sin solaparse ni dejar
//        hueco, tal como predice la formula con los `uv`/tamaños de
//        arriba.
//    Ninguna fila/columna del PNG real cae fuera de lo que predicen
//    estas 3 cajas (cabeza/cuerpo/pata) -- el Creeper NO tiene una
//    region "hat"/overlay invisible en su .geo.json base (existe una
//    variante `geometry.creeper.charged.v1.8` con `inflate: 2.0` para
//    el efecto visual de "cargado" por rayo, pero usa la MISMA textura
//    y las MISMAS cajas -- no aplica a este ticket, que es sobre el
//    modelo/textura BASE).
// Ticket 023: `left`/`right` describen el lado de PANTALLA (no el lado
// anatomico del personaje) -- ver `classicBipedGeometry.ts` para la
// justificacion completa de este cambio, aplicado por igual a cualquier
// mob porque la camara del visor 3D es la misma para todos.
const HEAD_FACE_LABELS: FaceLabels = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral izquierdo',
  right: 'Lateral derecho',
};

const BODY_FACE_LABELS: FaceLabels = {
  front: 'Pecho',
  back: 'Espalda',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Costado izquierdo',
  right: 'Costado derecho',
};

// Sin lateralidad (mismo criterio que ARM_FACE_LABELS/SPIDER_LEG_FACE_LABELS):
// las 4 patas comparten la MISMA region UV -- pintar una afecta a las 4 a la vez.
const CREEPER_LEG_FACE_LABELS: FaceLabels = {
  front: 'Pata — Frente',
  back: 'Pata — Atrás',
  top: 'Pata — Superior',
  bottom: 'Pata — Inferior',
  left: 'Pata — Lateral',
  right: 'Pata — Lateral',
};

const LEG_SIZE: [number, number, number] = [4, 6, 4];
const LEG_UV = { x: 0, y: 16 };

export const CREEPER_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: {
      size: [8, 8, 8],
      position: [0, 22, 0],
      uv: { x: 0, y: 0 },
      faceLabels: HEAD_FACE_LABELS,
    },
    body: {
      size: [8, 12, 4],
      position: [0, 12, 0],
      uv: { x: 16, y: 16 },
      faceLabels: BODY_FACE_LABELS,
    },
    // "Right"/"Left" = lado ANATOMICO del personaje (x negativo =
    // derecho, misma convencion que armRight/legRight del biped).
    legFrontRight: { size: LEG_SIZE, position: [-2, 3, 4], uv: LEG_UV, faceLabels: CREEPER_LEG_FACE_LABELS, group: 'creeperLeg' },
    legFrontLeft: { size: LEG_SIZE, position: [2, 3, 4], uv: LEG_UV, faceLabels: CREEPER_LEG_FACE_LABELS, group: 'creeperLeg' },
    legBackRight: { size: LEG_SIZE, position: [-2, 3, -4], uv: LEG_UV, faceLabels: CREEPER_LEG_FACE_LABELS, group: 'creeperLeg' },
    legBackLeft: { size: LEG_SIZE, position: [2, 3, -4], uv: LEG_UV, faceLabels: CREEPER_LEG_FACE_LABELS, group: 'creeperLeg' },
  },
};
