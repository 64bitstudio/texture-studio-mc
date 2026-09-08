import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { applyBoxUV } from '../geometry/applyBoxUV';
import { CAMERA_FOV_DEG, computeMobCameraFraming } from '../geometry/geometryBounds';
import type { BoneOverrides } from '../animation/interpolation';
import type { MobGeometry, MobBoxPart } from '../types/baseAssets';

interface MobPartMeshProps {
  part: MobBoxPart;
  textureWidth: number;
  textureHeight: number;
  material: THREE.Material;
  /**
   * Rotación DELTA (grados, se SUMA a `part.rotation ?? 0`) -- ticket
   * 090, animación de una caja con `pivot` (patas de la Araña). Solo
   * rotación: las patas con pivote quedan fuera del anidado
   * padre-hijo del ticket 090 (ver comentario de `MobModel` mas abajo),
   * asi que no reciben `position`/`scale` -- se pueden animar en su
   * lugar (rotar alrededor de su propio pivote), pero no las arrastra
   * un padre animado.
   */
  rotationOverrideDeg?: [number, number, number];
}

const DEG_TO_RAD = Math.PI / 180;

function useMobPartGeometry(part: Pick<MobBoxPart, 'size' | 'uv' | 'mirrorX' | 'swapFrontBack'>, textureWidth: number, textureHeight: number): THREE.BoxGeometry {
  return useMemo(() => {
    const [w, h, d] = part.size;
    const box = new THREE.BoxGeometry(w, h, d);
    applyBoxUV(box, { u: part.uv.x, v: part.uv.y, w, h, d, mirrorX: part.mirrorX, swapFrontBack: part.swapFrontBack, textureWidth, textureHeight });
    return box;
  }, [part.size, part.uv.x, part.uv.y, part.mirrorX, part.swapFrontBack, textureWidth, textureHeight]);
}

/**
 * Props del piso cuadriculado del visor (ver `Viewer3D`).
 *
 * Ticket 051 (corrección de Marco): revierte las 2 paredes agregadas
 * en el ticket 050 ("mejor solo deja la cuadricula del piso") -- vuelve
 * a ser un único plano horizontal, sin `side: THREE.DoubleSide` (esa
 * prop solo hacía falta para las paredes rotadas, ver el ticket 050 en
 * `docs/ARQUITECTURA.md` para el porqué -- el piso, sin rotación,
 * siempre se vio bien con el `side: THREE.BackSide` por defecto del
 * `<Grid>` de drei).
 *
 * Colores RE-MUESTREADOS de la imagen de referencia que mandó Marco
 * (Python/PIL, no a ojo -- ver `docs/ARQUITECTURA.md`, "Ticket 051"):
 * mucho más sutiles/apagados que la revisión del ticket 050
 * (`#274435`/`#3c6b4f`) -- las líneas de la cuadrícula de referencia
 * son casi imperceptibles, apenas un poco más claras que el fondo.
 */
const FLOOR_GRID_PROPS = {
  cellSize: 4,
  cellThickness: 0.6,
  cellColor: '#20392c',
  sectionSize: 20,
  sectionThickness: 1,
  sectionColor: '#2c4d3c',
  fadeDistance: 220,
  fadeStrength: 1,
  infiniteGrid: true,
} as const;

/** Una caja del modelo (cabeza/cuerpo/brazo/pierna) con su UV clasico ya aplicado. */
function MobPartMesh({ part, textureWidth, textureHeight, material, rotationOverrideDeg }: MobPartMeshProps) {
  const geometry = useMobPartGeometry(part, textureWidth, textureHeight);

  // Sin `pivot`: comportamiento identico al de antes del ticket 024
  // (Esqueleto/Zombie/Creeper) -- la caja se posiciona directamente,
  // sin rotacion. (Este camino no lo usa `MobModel`, ver mas abajo --
  // toda caja SIN `pivot` pasa por `HierarchyPartGroup`, ticket 090 --
  // se deja aca solo porque `NuevoProyecto.tsx`/otros consumidores
  // futuros de `MobPartMesh` en aislado podrian necesitarlo.)
  if (!part.pivot) {
    return <mesh geometry={geometry} material={material} position={part.position} />;
  }

  // Con `pivot` (ticket 024, ej. patas de la Araña): la caja se envuelve
  // en un grupo posicionado en el pivote y rotado segun `rotation`
  // (grados -> radianes), con la caja posicionada RELATIVA a ese pivote
  // -- reproduce la misma jerarquia bone-pivot-cubo que usa el .geo.json
  // + la animacion oficial de Mojang (ver `spiderGeometry.ts`), en vez
  // de rotar alrededor del centro de la propia caja (que produciria una
  // pose incorrecta).
  const [px, py, pz] = part.pivot;
  const [baseRx = 0, baseRy = 0, baseRz = 0] = part.rotation ?? [0, 0, 0];
  const [overrideRx = 0, overrideRy = 0, overrideRz = 0] = rotationOverrideDeg ?? [0, 0, 0];
  const rx = baseRx + overrideRx;
  const ry = baseRy + overrideRy;
  const rz = baseRz + overrideRz;
  const relativePosition: [number, number, number] = [
    part.position[0] - px,
    part.position[1] - py,
    part.position[2] - pz,
  ];

  return (
    <group position={[px, py, pz]} rotation={[rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD]}>
      <mesh geometry={geometry} material={material} position={relativePosition} />
    </group>
  );
}

interface HierarchyPartGroupProps {
  name: string;
  part: MobBoxPart;
  geometry: MobGeometry;
  textureWidth: number;
  textureHeight: number;
  material: THREE.Material;
  boneOverrides?: BoneOverrides;
}

/**
 * Una caja SIN `pivot`, como un `<group>` que anida recursivamente a
 * sus hijas por `parentId` (ticket 090, mismo patron de scene graph ya
 * usado por `EditableBoxGroup`/`BoxTree` en `ModelEditor3D.tsx`, ticket
 * 084) -- mover/rotar el grupo de un padre arrastra automaticamente a
 * sus hijos anidados, gratis, via el propio scene graph de three.js.
 *
 * Para una caja sin `parentId` (los 4 mobs vainilla, o cualquier caja
 * raiz), `part.position` sigue siendo absoluta -- CERO cambio de
 * comportamiento frente al `<mesh position={part.position}>` plano que
 * renderizaba `MobPartMesh` antes de este ticket, solo que ahora
 * envuelto en un `<group>` (con rotacion/escala en identidad por
 * default) para poder anidar hijas adentro si las tiene.
 *
 * `boneOverrides` (ticket 090, ver `animation/interpolation.ts`) son
 * DELTAS respecto a la pose base: se SUMAN a `position`/`rotation` y se
 * MULTIPLICAN a la escala (neutro 1) -- asi una animacion nunca
 * necesita conocer la pose de reposo exacta de un hueso para poder
 * "sumarle" un movimiento.
 */
function HierarchyPartGroup({ name, part, geometry, textureWidth, textureHeight, material, boneOverrides }: HierarchyPartGroupProps) {
  const meshGeometry = useMobPartGeometry(part, textureWidth, textureHeight);
  const override = boneOverrides?.[name];

  const [bx, by, bz] = part.position;
  const position: [number, number, number] = override?.position ? [bx + override.position.x, by + override.position.y, bz + override.position.z] : [bx, by, bz];

  const [brx = 0, bry = 0, brz = 0] = part.rotation ?? [0, 0, 0];
  const rotationDeg: [number, number, number] = override?.rotation ? [brx + override.rotation.x, bry + override.rotation.y, brz + override.rotation.z] : [brx, bry, brz];

  const scale: [number, number, number] = override?.scale ? [override.scale.x, override.scale.y, override.scale.z] : [1, 1, 1];

  const children = Object.entries(geometry.parts).filter(([, childPart]) => childPart.parentId === name && !childPart.pivot);

  return (
    <group position={position} rotation={[rotationDeg[0] * DEG_TO_RAD, rotationDeg[1] * DEG_TO_RAD, rotationDeg[2] * DEG_TO_RAD]} scale={scale}>
      <mesh geometry={meshGeometry} material={material} />
      {children.map(([childName, childPart]) => (
        <HierarchyPartGroup key={childName} name={childName} part={childPart} geometry={geometry} textureWidth={textureWidth} textureHeight={textureHeight} material={material} boneOverrides={boneOverrides} />
      ))}
    </group>
  );
}

interface MobModelProps {
  texture: THREE.Texture;
  geometry: MobGeometry;
  boneOverrides?: BoneOverrides;
}

/**
 * Geometria + material del modelo. La `texture` ya viene lista (creada
 * y sincronizada por `useCanvasTexture` en `Editor.tsx` a partir del
 * `TextureBuffer` compartido) -- este componente ya no la carga/decodifica
 * el mismo (ver ticket 001 para la version anterior con `useLoader` +
 * `Suspense`, reemplazada en el ticket 002 porque ahora la textura vive
 * en memoria desde el momento en que el asset base termina de
 * decodificarse en `Editor.tsx`, no en un fetch de imagen aparte).
 *
 * Ticket 090 -- las cajas se separan en dos grupos de renderizado:
 * las que tienen `pivot` (patas de la Araña, ticket 024) siguen
 * renderizandose FLAT como siempre via `MobPartMesh` -- quedan
 * deliberadamente fuera del anidado padre-hijo de abajo (ver el
 * comentario de `HierarchyPartGroup`: la matematica de `pivot` y la de
 * `parentId`-relativo, ticket 084, todavia no estan reconciliadas; una
 * pata con pivote SI puede animarse en su lugar -- gira alrededor de su
 * propio pivote -- pero no la arrastra un padre animado, limitacion
 * senalada explicitamente, ver el "Hecho" del ticket 090). El resto
 * (todas las cajas de Esqueleto/Zombie/Creeper, y cuerpo/cabeza/abdomen
 * de la Araña) se renderiza via `HierarchyPartGroup`, que anida por
 * `parentId` -- para una geometria SIN jerarquia en absoluto (los 4
 * mobs vainilla tal como los sirve el backend hoy, sin pasar por el
 * editor de modelo) esto es un cambio de CERO comportamiento visual:
 * cada caja no tiene padre, asi que se renderiza como raiz con su
 * `position` absoluta de siempre, solo que envuelta en un `<group>` en
 * vez de un `<mesh>` suelto.
 */
function MobModel({ texture, geometry, boneOverrides }: MobModelProps) {
  const material = useMemo(
    () =>
      // MeshBasicMaterial (sin luces): el objetivo es previsualizar la
      // textura tal cual, sin sombreado que altere los colores -- clave
      // para el editor de pixeles.
      //
      // Ticket 051 (hallazgo real, corrección de Marco: "siempre se ve
      // como brilloso, no se respetan los colores reales"): `<Canvas>`
      // de react-three-fiber aplica `ACESFilmicToneMapping` por default
      // a TODO el renderer -- una curva de tono pensada para escenas con
      // iluminación realista, que reinterpreta/satura los colores en vez
      // de reproducirlos tal cual (exactamente lo contrario de lo que
      // necesita un editor de textura pixel a pixel, donde cada píxel
      // debe verse con su color RGB real, no una versión "cinematográfica"
      // de él). `toneMapped: false` en el material saca a ESTE material
      // específico de ese pipeline -- sin tocar `<Canvas>` globalmente
      // (más seguro/acotado si en el futuro se agrega algo que sí
      // necesite tone mapping, ej. luces reales).
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, toneMapped: false }),
    [texture],
  );

  const { parts, textureWidth, textureHeight } = geometry;

  const pivotEntries = Object.entries(parts).filter(([, part]) => part.pivot);
  const rootEntries = Object.entries(parts).filter(([, part]) => !part.pivot && (!part.parentId || !(part.parentId in parts)));

  return (
    <group>
      {pivotEntries.map(([name, part]) => (
        <MobPartMesh
          key={name}
          part={part}
          textureWidth={textureWidth}
          textureHeight={textureHeight}
          material={material}
          rotationOverrideDeg={boneOverrides?.[name]?.rotation ? [boneOverrides[name]!.rotation.x, boneOverrides[name]!.rotation.y, boneOverrides[name]!.rotation.z] : undefined}
        />
      ))}
      {rootEntries.map(([name, part]) => (
        <HierarchyPartGroup key={name} name={name} part={part} geometry={geometry} textureWidth={textureWidth} textureHeight={textureHeight} material={material} boneOverrides={boneOverrides} />
      ))}
    </group>
  );
}

export interface Viewer3DProps {
  texture: THREE.Texture;
  geometry: MobGeometry;
  /**
   * Nombre legible del mob activo (ticket 018, `MOB_REGISTRY.label`) --
   * antes de este ticket el `aria-label` decia "Esqueleto" hardcodeado,
   * lo cual quedaria incorrecto/enganoso para lectores de pantalla en
   * cuanto el visor pudiera mostrar cualquier otro mob (regla de
   * accesibilidad del equipo: el nombre accesible debe describir lo que
   * realmente se ve, no un valor fijo de un ticket anterior).
   */
  mobLabel: string;
  /**
   * Acerca la cámara INICIAL hacia `target` (nunca hacia el origen del
   * mundo) por este factor, `1` = posición fija de siempre (sin
   * cambios). Pedido de Marco (revisión en vivo del ticket 072): el
   * panel "Vista previa 3D" del Editor se veía chico al abrir -- mismo
   * criterio/fórmula que `CAMERA_ZOOM` en `renderMobSnapshot3D.ts`
   * (ticket 065), aplicado aca al `<Canvas camera>` inicial en vez de a
   * una foto fija. Solo afecta el encuadre AL MONTAR -- `OrbitControls`
   * sigue permitiendo alejar/acercar libremente después, sin límite
   * artificial. Opcional (default `1`) para no afectar a `NuevoProyecto.tsx`,
   * el otro consumidor de este componente, que no pidió este cambio.
   */
  cameraZoom?: number;
  /**
   * Pose animada a superponer sobre la geometria base (ticket 090,
   * Etapa 4) -- ver `animation/interpolation.ts#sampleAnimationAtTime`.
   * Opcional y sin efecto en ningun consumidor existente (`Editor.tsx`/
   * `NuevoProyecto.tsx`) que no lo pase.
   */
  boneOverrides?: BoneOverrides;
}

/**
 * Visor 3D del mob activo (HU-1/HU-2). Geometria por cajas + UV
 * clasico, controles de camara orbit/zoom/pan via drei `OrbitControls`.
 * Ver docs/COMPONENTES.md.
 */
export function Viewer3D({ texture, geometry, mobLabel, cameraZoom = 1, boneOverrides }: Viewer3DProps) {
  // Ticket 020 (target de OrbitControls) + ticket 077 (encuadre
  // completo -- elevacion/distancia/lado de camara segun la forma real
  // del mob, ademas de re-centrar el target en la cabeza). Formula
  // compartida con `renderMobSnapshot3D.ts` (la miniatura de las
  // tarjetas) via `computeMobCameraFraming` -- ver ese comentario en
  // `geometryBounds.ts` para el detalle completo de las 6 rondas que
  // llevaron a esta formula. Compartirla evita que el visor interactivo
  // y la miniatura fija se desincronicen (bug real: la miniatura seguia
  // mostrando a la Araña "volteada" despues de corregir el visor).
  const { target, cameraPosition } = useMemo(() => computeMobCameraFraming(geometry, cameraZoom), [geometry, cameraZoom]);

  return (
    <div
      role="img"
      aria-label={`Vista 3D del modelo del ${mobLabel} de Minecraft, con controles de camara orbitales`}
      style={{ width: '100%', height: '100%' }}
    >
      <Canvas camera={{ position: cameraPosition, fov: CAMERA_FOV_DEG, near: 0.1, far: 1000 }}>
        {/* Ticket 049 había puesto un fondo verde oscuro (pedido
            explícito de Marco en ese momento). Ticket 052 lo revierte:
            Marco mandó captura + imagen de referencia lado a lado
            señalando que el color no coincidía -- muestreo real de la
            referencia (Python/PIL, zona de fondo lejos del modelo y la
            cuadrícula) dio un promedio de `rgb(16,21,26)`, un dark
            NEUTRO/azulado, no verde. `#0f171d` -- el mismo `--bg` que ya
            usa el resto de la app (`index.css`) -- es prácticamente
            idéntico a ese muestreo, así que se reusa ese valor en vez de
            inventar uno nuevo. */}
        <color attach="background" args={['#0f171d']} />
        {/* Ticket 048/049 (pedido de Marco: cuadrícula real dentro de la
            escena, NO un truco de CSS detrás del canvas -- quedaba tapado
            por el fondo opaco de `<color>` de arriba, ver
            docs/ARQUITECTURA.md, "Ticket 048"). `position={[0, 0, 0]}`
            asume pies en y=0 (cierto para los 4 mobs actuales, ver
            comentario de `computeGeometryCenter`/`geometryBounds.ts`).
            `args={[300, 300]}` (ticket 049, no `[10, 10]`) -- ese valor es
            el tamaño FÍSICO real del plano (aunque `infiniteGrid`
            desvanezca la cuadrícula "al infinito" con un shader, el plano
            en sí sigue siendo del tamaño de `args`; a la escala de esta
            escena -- cámara a ~90 unidades del origen -- un plano de
            10x10 quedaba MUY por debajo del área visible, cortando la
            cuadrícula antes de que pudiera desvanecerse de forma
            natural).
            Ticket 050 había agregado 2 paredes ("imagina que el mob esta
            dentro de una caja"); ticket 051 las revirtió ("mejor solo deja
            la cuadricula del piso") -- ver `FLOOR_GRID_PROPS` arriba para
            el porqué de los colores. */}
        <Grid position={[0, 0, 0]} args={[300, 300]} {...FLOOR_GRID_PROPS} />
        <MobModel texture={texture} geometry={geometry} boneOverrides={boneOverrides} />
        <OrbitControls target={target} enableDamping />
      </Canvas>
    </div>
  );
}
