import type { MobGeometry } from '../types/baseAssets.js';

// Geometria por cajas + UV clasico del modelo biped vanilla del Zombie
// (ticket 017 -- ver docs/definiciones/multi-mob-y-proyectos-guardados.md,
// "Diseño técnico"). Mismo shape que `skeletonGeometry.ts` -- 6 cajas
// identicas en anatomia y en origenes UV -- pero brazos/piernas GRUESOS
// (tipo Steve), no los huesos delgados del Esqueleto.
//
// METODO DE VERIFICACION (el mismo estandar del ticket 009, ver
// docs/ARQUITECTURA.md "Ticket 009" y el comentario de cabecera de
// `skeletonGeometry.ts"): NO se copio el valor de `[4,12,4]` de memoria
// ni del documento de definicion sin confirmar -- se volvio a verificar
// en esta misma sesion contra dos fuentes independientes antes de
// escribir este archivo:
//
// 1) FUENTE OFICIAL -- fetch real (no de memoria) de
//    `Mojang/bedrock-samples/resource_pack/models/entity/zombie.geo.json`
//    (rama `main`, commit vigente al momento de este ticket). Extracto
//    relevante de cada bone (unidades = pixeles de modelo; `origin` es
//    la esquina inferior de la caja, no su centro -- convertido a
//    `position` = centro, restando/sumando `size/2`, igual que se hizo
//    para el Esqueleto):
//      - texturewidth/textureheight declarados en el .geo.json: 64x32
//        (formato "classic", ver mas abajo por que el archivo PNG real
//        es 64x64 de todas formas).
//      - head:  origin [-4, 24, -4], size [8,8,8],  uv [0,0]   -> position [0,28,0]
//      - body:  origin [-4, 12, -2], size [8,12,4], uv [16,16] -> position [0,18,0]
//      - rightArm: origin [-8,12,-2], size [4,12,4], uv [40,16] -> position [-6,18,0]
//      - leftArm:  origin [ 4,12,-2], size [4,12,4], uv [40,16], mirror:true -> position [6,18,0]
//      - rightLeg: origin [-3.9,0,-2], size [4,12,4], uv [0,16] -> position [-1.9,6,0]
//      - leftLeg:  origin [-0.1,0,-2], size [4,12,4], uv [0,16], mirror:true -> position [1.9,6,0]
//    Nota importante que SI cambia respecto a asumir "solo cambia el
//    tamaño, la posicion es igual que el Esqueleto": con brazos/piernas
//    mas gruesos, sus caras internas quedan pegadas al mismo borde del
//    torso (x=-4/x=4) que las del Esqueleto, pero su CENTRO se recorre
//    hacia afuera -- brazo en x=∓6 (no ∓5, que es el valor ya corregido
//    del Esqueleto para su caja de 2 de ancho) y pierna en x=∓1.9 (no
//    ∓2 -- el .geo.json oficial usa un offset asimetrico de 0.1 en cada
//    pierna, tecnica conocida de Mojang para evitar z-fighting entre las
//    dos piernas al tocarse en el centro; se preserva el valor exacto de
//    la fuente en vez de redondear a ∓2, mismo criterio de "verificar,
//    no asumir" de este ticket). El bone "hat" (overlay de cabeza, uv
//    [32,0], `neverRender: true`) existe en el .geo.json igual que en el
//    del Esqueleto y, al igual que alla, NO se modela como una caja
//    pintable propia en este proyecto (`MobBoxPart` no tiene una entrada
//    "hat" separada) -- mismo tratamiento ya aplicado al Esqueleto, no
//    es una omision nueva de este ticket.
//
// 2) VERIFICACION EMPIRICA pixel a pixel contra el asset vanilla real ya
//    cacheado (`~/tools/minecraft-texture-pack/vanilla-cache/zombie.png`,
//    confirmado 64x64 con `file`). Mapa de alpha (opaco/transparente) por
//    fila/columna, mismo metodo que el ticket 009 uso para el Esqueleto:
//      - Filas 0-15, columnas 0-31: cross de la cabeza (uv 0,0, 8x8x8) --
//        identico al del Esqueleto, sin cambios.
//      - Filas 16-19 (banda superior height=depth=4 de piernas/torso/brazos):
//        el bloque opaco de las PIERNAS mide 8 columnas (columnas 4-11
//        dentro de su cross, es decir `2*w` con `w=4`) -- NO 4 columnas
//        (que seria `2*w` con `w=2`, el caso del Esqueleto). Confirma
//        `size.x = size.z = 4`, no 2.
//      - Filas 20-31 (banda lateral height=12): opaco continuo desde la
//        columna 0 hasta la 55 (56 columnas = cross de piernas [16] +
//        cross de torso [24] + cross de brazos [16]), sin huecos entre
//        cajas -- consistente con los 3 anchos de cross esperados para
//        piernas/brazos de 4 de grosor (16 cada uno) y torso 8x4 (24).
//      - Filas 32-63 (la mitad INFERIOR extra de la textura 64x64, que
//        el Esqueleto ni siquiera tiene): 100% transparente (alpha=0) en
//        las 64 columnas, sin excepcion -- confirmado programaticamente,
//        no a simple vista. CONCLUSION (pregunta explicita del ticket):
//        el Zombie vanilla NO usa esa mitad para nada -- ni overlay de
//        "sleeve"/"pants" (esas capas son del formato de skins de
//        JUGADOR, no de este mob), ni ninguna otra region UV activa. Es
//        espacio reservado/no usado en el PNG real (el .geo.json oficial
//        ya lo confirma indirectamente al declarar `textureheight: 32`,
//        la mitad de la altura real del archivo). Por eso `textureHeight`
//        abajo se deja en 64 (el tamaño REAL del archivo que sirve
//        `loadMobTexture`, no el declarado en el .geo.json) -- mismo
//        criterio ya usado para el Esqueleto (`textureHeight: 32` ahi
//        coincide con su PNG real de 64x32): el placeholder procedural y
//        el ancho/alto reportado en la respuesta de la API deben
//        coincidir con las dimensiones REALES del archivo servido, para
//        que el editor de textura (que dimensiona su buffer con
//        `texture.width/height` de la respuesta) muestre las 64x64
//        filas/columnas reales del asset sin recortar ni estirar nada.
//
// Convencion de ejes y de `left`/`right` anatomico: identica a
// `skeletonGeometry.ts` (ver ese archivo) -- no se repite aqui.
const HEAD_FACE_LABELS = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral derecho',
  right: 'Lateral izquierdo',
};

const BODY_FACE_LABELS = {
  front: 'Pecho',
  back: 'Espalda',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Costado derecho',
  right: 'Costado izquierdo',
};

// Sin lateralidad (mismo criterio del ticket 011 ya aplicado al
// Esqueleto): armRight/armLeft (y legRight/legLeft) comparten
// EXACTAMENTE la misma region UV -- pintar ahi afecta ambos lados 3D a
// la vez, asi que etiquetarlo "derecho"/"izquierdo" seria enganoso.
const ARM_FACE_LABELS = {
  front: 'Brazo — Frente',
  back: 'Brazo — Atrás',
  top: 'Brazo — Superior',
  bottom: 'Brazo — Inferior',
  left: 'Brazo — Lateral',
  right: 'Brazo — Lateral',
};

const LEG_FACE_LABELS = {
  front: 'Pierna — Frente',
  back: 'Pierna — Atrás',
  top: 'Pierna — Superior',
  bottom: 'Pierna — Inferior',
  left: 'Pierna — Lateral',
  right: 'Pierna — Lateral',
};

export const ZOMBIE_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 64,
  parts: {
    head: {
      size: [8, 8, 8],
      position: [0, 28, 0],
      uv: { x: 0, y: 0 },
      faceLabels: HEAD_FACE_LABELS,
    },
    body: {
      size: [8, 12, 4],
      position: [0, 18, 0],
      uv: { x: 16, y: 16 },
      faceLabels: BODY_FACE_LABELS,
    },
    armRight: {
      size: [4, 12, 4],
      position: [-6, 18, 0],
      uv: { x: 40, y: 16 },
      faceLabels: ARM_FACE_LABELS,
    },
    armLeft: {
      size: [4, 12, 4],
      position: [6, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
      faceLabels: ARM_FACE_LABELS,
    },
    legRight: {
      size: [4, 12, 4],
      position: [-1.9, 6, 0],
      uv: { x: 0, y: 16 },
      faceLabels: LEG_FACE_LABELS,
    },
    legLeft: {
      size: [4, 12, 4],
      position: [1.9, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
      faceLabels: LEG_FACE_LABELS,
    },
  },
};
