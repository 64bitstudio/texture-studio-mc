// Ticket 092 -- exportación a .bbmodel. Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md y
// `done/080-assets/test-model.bbmodel` (evidencia real, verificada en
// el juego, que fija el formato exacto).

import { describe, expect, it } from 'vitest';
import { blockbenchModelFileName, buildBlockbenchModel } from '../src/exportBlockbench';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';
import type { MobAnimation } from '../src/projectStorage';

const LABELS: FaceLabels = { front: 'Frente', back: 'Atrás', top: 'Arriba', bottom: 'Abajo', left: 'Izquierda', right: 'Derecha' };

/** Generador de UUID determinista para pruebas -- sin mockear `crypto`. */
function fakeUuid(): () => string {
  let n = 0;
  return () => `uuid-${n++}`;
}

const BIPED_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 64,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: LABELS },
    head: { size: [8, 8, 8], position: [0, 10, 0], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: LABELS },
    armRight: { size: [4, 12, 4], position: [-6, 8, 0], parentId: 'body', uv: { x: 40, y: 16 }, faceLabels: LABELS },
  },
};

const OPTIONS = { modelName: 'zombie', textureFileName: 'zombie.png', textureDataUrl: 'data:image/png;base64,AAAA', uuid: fakeUuid() };

describe('buildBlockbenchModel -- meta/resolution/textures', () => {
  it('usa model_format "free" y box_uv false en meta (formato confirmado por el spike 080)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.meta).toEqual({ format_version: '4.5', model_format: 'free', box_uv: false });
  });

  it('la resolucion viene de textureWidth/textureHeight de la geometria', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.resolution).toEqual({ width: 64, height: 64 });
  });

  it('el objeto de textura trae el set COMPLETO de campos (hallazgo confirmado: FreeMinecraftModels falla si falta alguno)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const texture = model.textures[0]!;
    for (const field of ['path', 'name', 'folder', 'namespace', 'id', 'uuid', 'source', 'width', 'height', 'uv_width', 'uv_height', 'particle', 'layers_enabled', 'render_mode', 'relative_path', 'frame_time', 'frame_order_type', 'frame_interpolate', 'frame_order', 'sync', 'syncToProject', 'use_as_default', 'internal', 'visible', 'selected', 'mode', 'saved']) {
      expect(texture).toHaveProperty(field);
    }
    expect(texture.source).toBe('data:image/png;base64,AAAA');
    expect(texture.name).toBe('zombie.png');
  });

  it('animations viene vacio -- este ticket no exporta animaciones (ticket 093)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.animations).toEqual([]);
  });
});

describe('buildBlockbenchModel -- elements (from/to/origin)', () => {
  it('from/to son position ± size/2 en espacio absoluto, sin transformar ejes (misma convencion que el archivo real del ticket 080)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const body = model.elements.find((e) => e.name === 'body')!;
    expect(body.from).toEqual([-4, 12, -2]);
    expect(body.to).toEqual([4, 24, 2]);
  });

  it('una caja con parentId resuelve su from/to en espacio ABSOLUTO (posicion relativa + la del padre)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const head = model.elements.find((e) => e.name === 'head')!;
    // head.position [0,10,0] es relativa a body [0,18,0] -> absoluta [0,28,0].
    expect(head.from).toEqual([-4, 24, -4]);
    expect(head.to).toEqual([4, 32, 4]);
  });

  it('el elemento nunca tiene rotacion propia (vive en el grupo, no en el cubo)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    for (const element of model.elements) {
      expect(element.rotation).toEqual([0, 0, 0]);
    }
  });

  it('origin es la posicion absoluta de la caja cuando no tiene pivot', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const armRight = model.elements.find((e) => e.name === 'armRight')!;
    expect(armRight.origin).toEqual([-6, 26, 0]); // [-6,8,0] relativa a body [0,18,0]
  });

  it('origin es el pivot cuando la caja lo tiene (patas de la Araña, ticket 024)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        leg1Right: { size: [16, 2, 2], position: [-11, 9, -1], uv: { x: 18, y: 0 }, faceLabels: LABELS, pivot: [-4, 9, -1], rotation: [0, -45, 45] },
      },
    };
    const model = buildBlockbenchModel(geometry, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.elements[0]!.origin).toEqual([-4, 9, -1]);
  });
});

describe('buildBlockbenchModel -- faces (mapeo de ejes)', () => {
  it('mapea top/bottom/right/left/front/back a up/down/east/west/south/north, con los rects correctos', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const body = model.elements.find((e) => e.name === 'body')!;
    const [w, h, d] = BIPED_GEOMETRY.parts.body!.size;
    const { x } = BIPED_GEOMETRY.parts.body!.uv;
    const { y } = BIPED_GEOMETRY.parts.body!.uv;
    // top = up: origen del cross en (u+d, v), ancho w.
    expect(body.faces.up.uv).toEqual([x + d, y, x + d + w, y + d]);
    // front = south.
    expect(body.faces.south.uv).toEqual([x + d, y + d, x + d + w, y + d + h]);
    // texture siempre 0 (unica textura embebida).
    expect(body.faces.up.texture).toBe(0);
  });

  it('mirrorX intercambia east/west (right/left) -- mismo criterio que applyBoxUV.ts', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        legLeft: { size: [4, 12, 4], position: [2, 6, 0], uv: { x: 0, y: 16 }, mirrorX: true, faceLabels: LABELS },
      },
    };
    const withoutMirror = buildBlockbenchModel({ ...geometry, parts: { legLeft: { ...geometry.parts.legLeft!, mirrorX: false } } }, { ...OPTIONS, uuid: fakeUuid() });
    const withMirror = buildBlockbenchModel(geometry, { ...OPTIONS, uuid: fakeUuid() });
    expect(withMirror.elements[0]!.faces.east.uv).toEqual(withoutMirror.elements[0]!.faces.west.uv);
    expect(withMirror.elements[0]!.faces.west.uv).toEqual(withoutMirror.elements[0]!.faces.east.uv);
  });

  it('swapFrontBack intercambia south/north (front/back)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 32, y: 4 }, swapFrontBack: true, faceLabels: LABELS },
      },
    };
    const withoutSwap = buildBlockbenchModel({ ...geometry, parts: { head: { ...geometry.parts.head!, swapFrontBack: false } } }, { ...OPTIONS, uuid: fakeUuid() });
    const withSwap = buildBlockbenchModel(geometry, { ...OPTIONS, uuid: fakeUuid() });
    expect(withSwap.elements[0]!.faces.south.uv).toEqual(withoutSwap.elements[0]!.faces.north.uv);
  });
});

describe('buildBlockbenchModel -- outliner (jerarquia bone+cube)', () => {
  it('cada caja raiz aparece como un grupo de nivel superior', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.outliner).toHaveLength(1);
    expect(model.outliner[0]!.name).toBe('body');
  });

  it('el grupo de una caja incluye el UUID de su propio cubo, MAS los grupos de sus hijas anidadas (verificado contra el archivo real del ticket 080)', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const bodyGroup = model.outliner[0]!;
    const bodyElementUuid = model.elements.find((e) => e.name === 'body')!.uuid;

    expect(bodyGroup.children).toContain(bodyElementUuid);
    const nestedNames = bodyGroup.children.filter((c): c is Extract<typeof c, { name: string }> => typeof c === 'object').map((g) => g.name);
    expect(nestedNames).toEqual(expect.arrayContaining(['head', 'armRight']));
  });

  it('cada caja SIN hijas es un grupo de children=[uuid_de_su_propio_cubo] unicamente', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    const bodyGroup = model.outliner[0]!;
    const armRightGroup = bodyGroup.children.find((c) => typeof c === 'object' && c.name === 'armRight') as { children: unknown[] } | undefined;
    expect(armRightGroup?.children).toHaveLength(1);
  });

  it('la rotacion del grupo es part.rotation (o [0,0,0] si no tiene) -- nunca la del elemento', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        leg1Right: { size: [16, 2, 2], position: [-11, 9, -1], uv: { x: 18, y: 0 }, faceLabels: LABELS, pivot: [-4, 9, -1], rotation: [0, -45, 45] },
      },
    };
    const model = buildBlockbenchModel(geometry, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.outliner[0]!.rotation).toEqual([0, -45, 45]);
    expect(model.elements[0]!.rotation).toEqual([0, 0, 0]);
  });

  it('geometria con multiples raices (sin jerarquia) produce multiples grupos de nivel superior', () => {
    const flatGeometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        body: BIPED_GEOMETRY.parts.body!,
        head: { ...BIPED_GEOMETRY.parts.head!, parentId: undefined },
      },
    };
    const model = buildBlockbenchModel(flatGeometry, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.outliner).toHaveLength(2);
  });
});

describe('blockbenchModelFileName', () => {
  it('produce "<mobId>.bbmodel"', () => {
    expect(blockbenchModelFileName('zombie')).toBe('zombie.bbmodel');
  });
});

// Ticket 093 -- animaciones. Ver el comentario del módulo
// (`exportBlockbench.ts`) para la evidencia real que fija este formato.
describe('buildBlockbenchModel -- animations', () => {
  it('sin animaciones (u omitidas), produce animations: [] -- mismo comportamiento del ticket 092', () => {
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, uuid: fakeUuid() });
    expect(model.animations).toEqual([]);
  });

  it('animators se indexa por el UUID del GRUPO (bone), NUNCA el del elemento/cubo', () => {
    const animations: MobAnimation[] = [{ name: 'idle', loop: true, length: 2, bones: { armRight: [{ time: 0, rotation: { x: -5, y: 0, z: 0 } }] } }];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });

    const armRightGroupUuid = (model.outliner[0]!.children.find((c) => typeof c === 'object' && c.name === 'armRight') as { uuid: string }).uuid;
    const armRightElementUuid = model.elements.find((e) => e.name === 'armRight')!.uuid;

    const animators = model.animations[0]!.animators;
    expect(Object.keys(animators)).toEqual([armRightGroupUuid]);
    expect(Object.keys(animators)).not.toContain(armRightElementUuid);
    expect(animators[armRightGroupUuid]!.name).toBe('armRight');
    expect(animators[armRightGroupUuid]!.type).toBe('bone');
  });

  it('loop=true/false se traduce a "loop"/"once"', () => {
    const looping: MobAnimation = { name: 'idle', loop: true, length: 1, bones: { body: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } };
    const once: MobAnimation = { name: 'attack', loop: false, length: 0.5, bones: { body: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } };
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations: [looping, once], uuid: fakeUuid() });
    expect(model.animations[0]!.loop).toBe('loop');
    expect(model.animations[1]!.loop).toBe('once');
  });

  it('length/name viajan tal cual', () => {
    const animations: MobAnimation[] = [{ name: 'walk', loop: true, length: 0.7, bones: { body: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } }];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    expect(model.animations[0]!.name).toBe('walk');
    expect(model.animations[0]!.length).toBe(0.7);
  });

  it('un AnimationKeyframe con solo rotation produce UN keyframe de Blockbench, canal "rotation", data_points como strings', () => {
    const animations: MobAnimation[] = [{ name: 'idle', loop: true, length: 1, bones: { armRight: [{ time: 0, rotation: { x: -5, y: 0, z: 0 } }] } }];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    const groupUuid = Object.keys(model.animations[0]!.animators)[0]!;
    const keyframes = model.animations[0]!.animators[groupUuid]!.keyframes;
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0]).toMatchObject({ channel: 'rotation', time: 0, interpolation: 'linear' });
    expect(keyframes[0]!.data_points).toEqual([{ x: '-5', y: '0', z: '0' }]);
  });

  it('un AnimationKeyframe con rotation+position+scale produce 3 keyframes de Blockbench en el MISMO time, un canal cada uno', () => {
    const animations: MobAnimation[] = [
      { name: 'spawn', loop: false, length: 1, bones: { body: [{ time: 0.5, rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: -5, z: 0 }, scale: { x: 1, y: 1, z: 1 } }] } },
    ];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    const groupUuid = Object.keys(model.animations[0]!.animators)[0]!;
    const keyframes = model.animations[0]!.animators[groupUuid]!.keyframes;
    expect(keyframes).toHaveLength(3);
    expect(keyframes.map((k) => k.channel)).toEqual(['rotation', 'position', 'scale']);
    expect(keyframes.every((k) => k.time === 0.5)).toBe(true);
    expect(keyframes.find((k) => k.channel === 'position')!.data_points).toEqual([{ x: '0', y: '-5', z: '0' }]);
  });

  it('varios keyframes del mismo hueso producen varias entradas de rotation, una por tiempo', () => {
    const animations: MobAnimation[] = [
      {
        name: 'walk',
        loop: true,
        length: 0.7,
        bones: {
          armRight: [
            { time: 0, rotation: { x: -30, y: 0, z: 0 } },
            { time: 0.35, rotation: { x: 30, y: 0, z: 0 } },
            { time: 0.7, rotation: { x: -30, y: 0, z: 0 } },
          ],
        },
      },
    ];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    const groupUuid = Object.keys(model.animations[0]!.animators)[0]!;
    const keyframes = model.animations[0]!.animators[groupUuid]!.keyframes;
    expect(keyframes.map((k) => k.time)).toEqual([0, 0.35, 0.7]);
  });

  it('un hueso animado que ya no existe en la geometria se omite en silencio (geometria editada despues de animar)', () => {
    const animations: MobAnimation[] = [{ name: 'idle', loop: true, length: 1, bones: { fantasma: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } }];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    expect(model.animations[0]!.animators).toEqual({});
  });

  it('campos estaticos coinciden EXACTO con el archivo real verificado (override/anim_time_update/blend_weight/etc.)', () => {
    const animations: MobAnimation[] = [{ name: 'idle', loop: true, length: 2, bones: { body: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } }];
    const model = buildBlockbenchModel(BIPED_GEOMETRY, { ...OPTIONS, animations, uuid: fakeUuid() });
    const animation = model.animations[0]!;
    expect(animation.override).toBe(false);
    expect(animation.anim_time_update).toBe('');
    expect(animation.blend_weight).toBe('1');
    expect(animation.start_delay).toBe('');
    expect(animation.loop_delay).toBe('');
    expect(animation.snapping).toBe(24);
    expect(animation.selected).toBe(false);
    expect(animation.saved).toBe(true);
    expect(animation.path).toBe('');
  });
});
