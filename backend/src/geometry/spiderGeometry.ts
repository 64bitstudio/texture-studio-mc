import type { FaceLabels, MobGeometry } from '../types/baseAssets.js';

// Geometria de la Araña (ticket 020, ver
// docs/definiciones/multi-mob-y-proyectos-guardados.md y
// `pending/020-geometria-arana.md`, "Metodologia obligatoria"). A
// diferencia del Zombie (ticket 017, mismo biped de 6 cajas que el
// Esqueleto solo con brazos/piernas mas gruesos), la Araña tiene una
// anatomia que este proyecto nunca modelo -- cabeza+torax+abdomen y 8
// patas, sin brazos. Investigada desde cero, NO por analogia con otro
// mob (regla permanente del equipo, ver memoria
// `texture-studio-mc-metodologia-mobs`).
//
// 1) FUENTE OFICIAL -- fetch real (no de memoria) de
//    `Mojang/bedrock-samples/resource_pack/models/entity/spider.geo.json`
//    (rama `main`). `texturewidth`/`textureheight` declarados: 64x32
//    (formato clasico, SIN mitad inferior extra como el Zombie -- el PNG
//    real cacheado tambien es 64x32, ver punto 2). Bones (unidades =
//    pixeles de textura; `origin` es la esquina inferior de la caja,
//    convertida a `position` = centro sumando `size/2`, igual criterio
//    que Esqueleto/Zombie; ninguno de estos bones tiene `rotation`, asi
//    que `origin` ya esta en el mismo espacio absoluto para todos, sin
//    necesidad de acumular `pivot` de bones padre):
//      - "body0" (torax -- el segmento pegado a la cabeza y a las patas):
//        origin [-3,6,-3], size [6,6,6], uv [0,0]   -> position [0,9,0]
//      - "head": origin [-4,5,-11], size [8,8,8], uv [32,4]
//        -> position [0,9,-7]
//      - "body1" (abdomen -- el segmento grande de atras):
//        origin [-5,5,3], size [10,8,12], uv [0,12] -> position [0,9,9]
//      - "leg0".."leg7" (8 patas): TODAS size [16,2,2] Y el MISMO
//        uv [18,0] -- la Araña vanilla reusa una unica region UV para
//        las 8 patas (ni siquiera side derecho/izquierdo como
//        arm/legRight-Left del biped: las 8 comparten la misma caja).
//        `mirror: true` en leg1/3/5/7 (lado anatomico izquierdo, x>0);
//        leg0/2/4/6 sin mirror (lado derecho, x<0) -- misma convencion
//        ya usada por armRight/legRight (`position.x` negativo = lado
//        DERECHO del personaje, ver `classicBipedGeometry.ts`).
//        Origenes (`origin.z`, de mas cerca de la cabeza a mas cerca del
//        abdomen): leg6/7 z=-2..0, leg4/5 z=-1..1, leg2/3 z=0..2,
//        leg0/1 z=1..3 -- de ahi el nombre `leg1*`..`leg4*` de abajo
//        (1 = par mas cercano a la cabeza, 4 = par mas cercano al
//        abdomen), NO el mismo orden que el indice `legN` del .geo.json
//        oficial (que no sigue un orden espacial obvio).
//
// 2) VERIFICACION EMPIRICA pixel a pixel contra el asset vanilla real ya
//    cacheado (`~/tools/minecraft-texture-pack/vanilla-cache/spider.png`,
//    confirmado 64x32 con Pillow). Mapa de luminancia/alpha por
//    fila/columna (mismo metodo que el ticket 009 uso para el
//    Esqueleto), cruzado contra el rectangulo UV "cross" que predice
//    cada caja de arriba (formula de `applyBoxUV.ts`: ancho total
//    `2*w + 2*d`, alto total `h + d`, origen en `uv`):
//      - Fila 0: opaco en columnas 6-17 (12 columnas = cross top+bottom
//        del torax, `2*w=12` con `w=6` ✓) y en columnas 20-51 (32
//        columnas = cross top+bottom de las patas, `2*w=32` con
//        `w=16` ✓), con un hueco exacto en columnas 18-19 (la cara
//        `right` de las patas, `d=2`, que en fila 0 SI corresponde al
//        top -- no aparece hasta la fila 2, ver siguiente punto).
//      - Fila 2: el hueco de columnas 18-19 pasa a estar OPACO (cara
//        `right` de las patas, activa en filas 2-3 = `h=2`, justo
//        despues de las filas 0-1 del top/bottom, `d=2`) -- confirma
//        `size.y = size.z = 2` de las patas (caja delgada), no un
//        valor mayor.
//      - Filas 12-23: opaco continuo desde columna 12 hasta columna 63
//        (top+bottom del abdomen, columnas 12-31, seguido sin hueco por
//        right+front+left+back de la cabeza, columnas 32-63) --
//        confirma que ambas cajas coexisten en esas filas sin
//        solaparse ni dejar hueco, tal como predice la formula con los
//        `uv`/tamaños de arriba.
//      - Fila 24: opaco continuo de columna 0 a 46 (right+front+left+
//        back del abdomen concatenadas, `12+10+12+12=46`) -- confirma
//        `size` del abdomen `[10,8,12]`.
//    NINGUNA fila/columna del PNG real cae fuera de lo que predicen
//    estas 4 cajas (a diferencia del Esqueleto, la Araña NO tiene una
//    region "hat"/overlay invisible en su .geo.json -- no aplica la
//    mitigacion de `uvBoxCleanup.ts` a una zona extra, solo a estas 4
//    cajas reales, que es lo que ya hace automaticamente al derivarse
//    de `computeUVBoxRects`).
//
// NOTA sobre una nota previa NO verificada: `docs/ARQUITECTURA.md`
// (pipeline `minecraft-texture-pack`) tenia una nota heredada diciendo
// "cabeza+cuerpo en y0-23, patas en y24-31" -- el ticket 020 pedia
// explicitamente NO darla por sentada sin confirmar. Es INCORRECTA: la
// verificacion de arriba confirma que las patas estan en las filas 0-3
// (no 24-31) y que las filas 24-31 son el abdomen (no las patas). Se
// deja constancia aqui para que nadie la reuse en otro mob sin releer
// este comentario.
// Ticket 023: `left`/`right` describen el lado de PANTALLA (no el lado
// anatomico del personaje) -- ver `classicBipedGeometry.ts` para la
// justificacion completa de este cambio, aplicado por igual a cualquier
// mob porque la camara del visor 3D es la misma para todos.
const SPIDER_HEAD_FACE_LABELS: FaceLabels = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral izquierdo',
  right: 'Lateral derecho',
};

const SPIDER_THORAX_FACE_LABELS: FaceLabels = {
  front: 'Tórax — Frente',
  back: 'Tórax — Atrás',
  top: 'Tórax — Superior',
  bottom: 'Tórax — Inferior',
  left: 'Tórax — Costado izquierdo',
  right: 'Tórax — Costado derecho',
};

const SPIDER_ABDOMEN_FACE_LABELS: FaceLabels = {
  front: 'Abdomen — Frente',
  back: 'Abdomen — Atrás',
  top: 'Abdomen — Superior',
  bottom: 'Abdomen — Inferior',
  left: 'Abdomen — Costado izquierdo',
  right: 'Abdomen — Costado derecho',
};

// Sin lateralidad (mismo criterio que ARM_FACE_LABELS/LEG_FACE_LABELS
// del biped clasico, `classicBipedGeometry.ts`): las 8 patas comparten
// la MISMA region UV -- pintar una afecta a las 8 a la vez.
const SPIDER_LEG_FACE_LABELS: FaceLabels = {
  front: 'Pata — Frente',
  back: 'Pata — Atrás',
  top: 'Pata — Superior',
  bottom: 'Pata — Inferior',
  left: 'Pata — Lateral',
  right: 'Pata — Lateral',
};

const LEG_SIZE: [number, number, number] = [16, 2, 2];
const LEG_UV = { x: 18, y: 0 };

export const SPIDER_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: {
      size: [8, 8, 8],
      position: [0, 9, -7],
      uv: { x: 32, y: 4 },
      faceLabels: SPIDER_HEAD_FACE_LABELS,
    },
    thorax: {
      size: [6, 6, 6],
      position: [0, 9, 0],
      uv: { x: 0, y: 0 },
      faceLabels: SPIDER_THORAX_FACE_LABELS,
    },
    abdomen: {
      size: [10, 8, 12],
      position: [0, 9, 9],
      uv: { x: 0, y: 12 },
      faceLabels: SPIDER_ABDOMEN_FACE_LABELS,
    },
    // Par 1 = mas cercano a la cabeza .. par 4 = mas cercano al abdomen
    // (ver nota de orden espacial arriba). "Right"/"Left" = lado
    // ANATOMICO del personaje (x negativo = derecho), misma convencion
    // que armRight/legRight.
    leg1Right: { size: LEG_SIZE, position: [-11, 9, -1], uv: LEG_UV, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg1Left: { size: LEG_SIZE, position: [11, 9, -1], uv: LEG_UV, mirrorX: true, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg2Right: { size: LEG_SIZE, position: [-11, 9, 0], uv: LEG_UV, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg2Left: { size: LEG_SIZE, position: [11, 9, 0], uv: LEG_UV, mirrorX: true, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg3Right: { size: LEG_SIZE, position: [-11, 9, 1], uv: LEG_UV, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg3Left: { size: LEG_SIZE, position: [11, 9, 1], uv: LEG_UV, mirrorX: true, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg4Right: { size: LEG_SIZE, position: [-11, 9, 2], uv: LEG_UV, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
    leg4Left: { size: LEG_SIZE, position: [11, 9, 2], uv: LEG_UV, mirrorX: true, faceLabels: SPIDER_LEG_FACE_LABELS, group: 'spiderLeg' },
  },
};
