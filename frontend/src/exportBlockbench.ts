// Ticket 092 -- exportación a `.bbmodel` (Blockbench), geometría +
// jerarquía + textura (sin animaciones todavía, ver ticket 093). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- sin DOM/descarga, mismo criterio de
// separación ya establecido por `exportPack.ts` frente a `export.ts`
// (que sí depende de `<canvas>`/`Blob`/descarga en el navegador, ver
// ese archivo para el disparador real `exportMobBlockbench`).
//
// **FUENTE DE VERDAD, no supuesta**: el formato exacto se derivó del
// `.bbmodel` real, hecho a mano, verificado EN EL JUEGO por Marco
// contra FreeMinecraftModels (ticket 080, `done/080-assets/test-model.bbmodel`)
// -- confirma en la práctica el hallazgo ya documentado en el
// documento de definición: nunca usar el atajo `box_uv`/`uv_offset`
// solo, hay que escribir las 6 caras explícitas por caja, y el objeto
// de cada textura necesita su set COMPLETO de campos (no solo
// `width`/`height`/`source`) o el parser de FreeMinecraftModels falla.
//
// **Mapeo de ejes** (derivado cruzando ese mismo archivo real contra
// `applyBoxUV.ts`, ya verificado en producción): la geometría de este
// proyecto (`MobBoxPart.position`/`size`) YA está en el mismo espacio
// de coordenadas que `from`/`to`/`origin` de Blockbench -- SIN
// transformar nada (confirmado: el `body` del archivo real tiene
// `from`/`to` cuyo centro es exactamente `[0,18,0]`, el mismo valor de
// `position` que usa la geometría vainilla de este proyecto). Para las
// caras: Minecraft usa +X=este, -X=oeste, +Y=arriba, -Y=abajo,
// +Z=sur, -Z=norte (convención estándar) -- combinado con el orden ya
// verificado de `applyBoxUV.ts` (`right`→+X, `left`→-X, `front`→+Z,
// `back`→-Z), da: `right`→este, `left`→oeste, `front`→sur, `back`→norte,
// `top`→arriba, `bottom`→abajo. El intercambio de `mirrorX`/`swapFrontBack`
// se replica IDÉNTICO al de `applyBoxUV.ts` (mismas 2 líneas, mismo
// criterio que ya usa `geometryBounds.ts` para no importar three.js en
// un módulo puro).
//
// **Jerarquía como bone+cube pareados**: cada caja de `MobGeometry` se
// exporta como DOS nodos -- un elemento `cube` en `elements[]` (la
// geometría visible) y un grupo (bone) en `outliner` con su propio
// `origin`/`rotation`, cuyos `children` incluyen el UUID de su propio
// cubo MÁS los grupos de sus hijas anidadas (verificado contra el
// archivo real: el grupo "body" contiene tanto el UUID del cubo "body"
// como los sub-grupos "head"/"armRight"). La ROTACIÓN vive en el GRUPO,
// nunca en el elemento (`rotation: [0,0,0]` siempre en `elements[]`,
// idéntico al archivo real) -- así una caja con `pivot`+`rotation`
// (patas de la Araña) rota alrededor de `origin=pivot` exactamente
// igual que ya la renderiza `Viewer3D.tsx` (grupo envolvente + malla
// sin rotación propia), y el ticket 093 (animaciones) puede animar el
// GRUPO sin duplicar la rotación estática.

import { computeBoxFaceRects, type BoxFaceRects } from './geometry/applyBoxUV';
import { computeAbsolutePosition } from './geometry/hierarchy';
import type { MobBoxPart, MobGeometry } from './types/baseAssets';

const FORMAT_VERSION = '4.5';

export interface BlockbenchExportOptions {
  /** Nombre interno del modelo (`meta`/`name`, ticket 092). */
  modelName: string;
  /** Nombre de archivo de la textura embebida (solo metadata, la textura viaja embebida en `source` -- ningún archivo externo real). */
  textureFileName: string;
  /** PNG ya pintado, como `data:image/png;base64,...` -- se embebe tal cual (mismo criterio que `exportProjectZip`: el `pngDataUrl` guardado ya es el PNG final, limpio de zonas fuera de las cajas UV). */
  textureDataUrl: string;
  /** Generador de UUID inyectable -- pruebas deterministas sin mockear `crypto` (default `crypto.randomUUID`, disponible en cualquier navegador real). */
  uuid?: () => string;
}

interface BlockbenchCubeFace {
  uv: [number, number, number, number];
  texture: number;
}

interface BlockbenchElement {
  name: string;
  type: 'cube';
  uuid: string;
  from: [number, number, number];
  to: [number, number, number];
  origin: [number, number, number];
  rotation: [number, number, number];
  box_uv: false;
  faces: {
    up: BlockbenchCubeFace;
    down: BlockbenchCubeFace;
    east: BlockbenchCubeFace;
    west: BlockbenchCubeFace;
    south: BlockbenchCubeFace;
    north: BlockbenchCubeFace;
  };
}

interface BlockbenchOutlinerGroup {
  name: string;
  origin: [number, number, number];
  rotation: [number, number, number];
  uuid: string;
  children: (string | BlockbenchOutlinerGroup)[];
}

export interface BlockbenchModel {
  meta: { format_version: string; model_format: 'free'; box_uv: false };
  name: string;
  resolution: { width: number; height: number };
  elements: BlockbenchElement[];
  outliner: BlockbenchOutlinerGroup[];
  textures: Record<string, unknown>[];
  animations: unknown[];
}

/**
 * Rectángulo UV de una cara, con `mirrorX`/`swapFrontBack` ya
 * aplicados -- misma lógica de intercambio que `applyBoxUV.ts`, ver
 * comentario del módulo.
 */
function resolveFaceRects(part: Pick<MobBoxPart, 'mirrorX' | 'swapFrontBack'>, rects: BoxFaceRects): BoxFaceRects {
  let { right, left, front, back } = rects;
  const { top, bottom } = rects;
  if (part.mirrorX) {
    [right, left] = [left, right];
  }
  if (part.swapFrontBack) {
    [front, back] = [back, front];
  }
  return { right, left, front, back, top, bottom };
}

function toBlockbenchFace(rect: { x0: number; y0: number; x1: number; y1: number }): BlockbenchCubeFace {
  return { uv: [rect.x0, rect.y0, rect.x1, rect.y1], texture: 0 };
}

function buildElement(name: string, part: MobBoxPart, absolutePosition: [number, number, number], uuid: string): BlockbenchElement {
  const [w, h, d] = part.size;
  const [cx, cy, cz] = absolutePosition;
  const rects = resolveFaceRects(part, computeBoxFaceRects(part.uv.x, part.uv.y, w, h, d));
  const origin: [number, number, number] = part.pivot ?? absolutePosition;

  return {
    name,
    type: 'cube',
    uuid,
    from: [cx - w / 2, cy - h / 2, cz - d / 2],
    to: [cx + w / 2, cy + h / 2, cz + d / 2],
    origin,
    rotation: [0, 0, 0],
    box_uv: false,
    faces: {
      up: toBlockbenchFace(rects.top),
      down: toBlockbenchFace(rects.bottom),
      east: toBlockbenchFace(rects.right),
      west: toBlockbenchFace(rects.left),
      south: toBlockbenchFace(rects.front),
      north: toBlockbenchFace(rects.back),
    },
  };
}

/**
 * Construye el modelo `.bbmodel` completo (geometría + jerarquía +
 * textura, sin animaciones -- ticket 093) a partir de `geometry`. No
 * asume que `geometry` ya tiene jerarquía poblada -- quien llama
 * (`export.ts`) es responsable de aplicar `applyDefaultHierarchy` antes
 * si hace falta (mismo criterio ya establecido por `AnimationEditor.tsx`,
 * ticket 090: cualquier mob, vainilla o custom, exporta con una
 * jerarquía de huesos real).
 */
export function buildBlockbenchModel(geometry: MobGeometry, options: BlockbenchExportOptions): BlockbenchModel {
  const uuid = options.uuid ?? (() => crypto.randomUUID());

  const elementUuids: Record<string, string> = {};
  const groupUuids: Record<string, string> = {};
  for (const name of Object.keys(geometry.parts)) {
    elementUuids[name] = uuid();
    groupUuids[name] = uuid();
  }

  const childrenByParent = new Map<string | undefined, string[]>();
  for (const [name, part] of Object.entries(geometry.parts)) {
    const parentKey = part.parentId && part.parentId in geometry.parts ? part.parentId : undefined;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(name);
    childrenByParent.set(parentKey, siblings);
  }

  const elements: BlockbenchElement[] = [];

  function buildGroup(name: string): BlockbenchOutlinerGroup {
    const part = geometry.parts[name]!;
    const absolutePosition = computeAbsolutePosition(geometry, name);
    elements.push(buildElement(name, part, absolutePosition, elementUuids[name]!));

    const childNames = childrenByParent.get(name) ?? [];
    const origin: [number, number, number] = part.pivot ?? absolutePosition;

    return {
      name,
      origin,
      rotation: part.rotation ?? [0, 0, 0],
      uuid: groupUuids[name]!,
      children: [elementUuids[name]!, ...childNames.map((childName) => buildGroup(childName))],
    };
  }

  const rootNames = childrenByParent.get(undefined) ?? [];
  const outliner = rootNames.map((name) => buildGroup(name));

  return {
    meta: { format_version: FORMAT_VERSION, model_format: 'free', box_uv: false },
    name: options.modelName,
    resolution: { width: geometry.textureWidth, height: geometry.textureHeight },
    elements,
    outliner,
    textures: [
      {
        path: '',
        name: options.textureFileName,
        folder: 'block',
        namespace: '',
        id: '0',
        uuid: uuid(),
        source: options.textureDataUrl,
        width: geometry.textureWidth,
        height: geometry.textureHeight,
        uv_width: geometry.textureWidth,
        uv_height: geometry.textureHeight,
        particle: false,
        layers_enabled: false,
        render_mode: 'default',
        relative_path: '',
        frame_time: 1,
        frame_order_type: 'loop',
        frame_interpolate: false,
        frame_order: '',
        sync: false,
        syncToProject: false,
        use_as_default: false,
        internal: true,
        visible: true,
        selected: false,
        mode: 'bitmap',
        saved: true,
      },
    ],
    animations: [],
  };
}

/** Nombre de archivo de descarga del `.bbmodel` de un mob (ver `export.ts`). */
export function blockbenchModelFileName(mobId: string): string {
  return `${mobId}.bbmodel`;
}
