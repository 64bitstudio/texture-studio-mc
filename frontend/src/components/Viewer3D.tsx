import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { applyBoxUV } from '../geometry/applyBoxUV';
import { computeGeometryCenter } from '../geometry/geometryBounds';
import type { MobGeometry, MobBoxPart } from '../types/baseAssets';

interface MobPartMeshProps {
  part: MobBoxPart;
  textureWidth: number;
  textureHeight: number;
  material: THREE.Material;
}

const DEG_TO_RAD = Math.PI / 180;

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
function MobPartMesh({ part, textureWidth, textureHeight, material }: MobPartMeshProps) {
  const geometry = useMemo(() => {
    const [w, h, d] = part.size;
    const box = new THREE.BoxGeometry(w, h, d);
    applyBoxUV(box, {
      u: part.uv.x,
      v: part.uv.y,
      w,
      h,
      d,
      mirrorX: part.mirrorX,
      textureWidth,
      textureHeight,
    });
    return box;
  }, [part.size, part.uv.x, part.uv.y, part.mirrorX, textureWidth, textureHeight]);

  // Sin `pivot`: comportamiento identico al de antes del ticket 024
  // (Esqueleto/Zombie/Creeper) -- la caja se posiciona directamente,
  // sin rotacion.
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
  const [rx = 0, ry = 0, rz = 0] = part.rotation ?? [0, 0, 0];
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

interface MobModelProps {
  texture: THREE.Texture;
  geometry: MobGeometry;
}

/**
 * Geometria + material del modelo. La `texture` ya viene lista (creada
 * y sincronizada por `useCanvasTexture` en `Editor.tsx` a partir del
 * `TextureBuffer` compartido) -- este componente ya no la carga/decodifica
 * el mismo (ver ticket 001 para la version anterior con `useLoader` +
 * `Suspense`, reemplazada en el ticket 002 porque ahora la textura vive
 * en memoria desde el momento en que el asset base termina de
 * decodificarse en `Editor.tsx`, no en un fetch de imagen aparte).
 */
function MobModel({ texture, geometry }: MobModelProps) {
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

  return (
    <group>
      {Object.entries(parts).map(([name, part]) => (
        <MobPartMesh
          key={name}
          part={part}
          textureWidth={textureWidth}
          textureHeight={textureHeight}
          material={material}
        />
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
}

/**
 * Visor 3D del mob activo (HU-1/HU-2). Geometria por cajas + UV
 * clasico, controles de camara orbit/zoom/pan via drei `OrbitControls`.
 * Ver docs/COMPONENTES.md.
 */
export function Viewer3D({ texture, geometry, mobLabel }: Viewer3DProps) {
  // Ticket 020 (hallazgo durante la Araña): el `target` de OrbitControls
  // era un valor fijo `[0, 16, 0]` -- correcto SOLO por coincidencia
  // para el biped clasico (ver `geometryBounds.ts`). Se calcula ahora
  // del bounding box real de la geometria activa, para que cualquier
  // mob futuro (Araña, Creeper, lo que sea) quede centrado en camara sin
  // tener que ajustar este componente de nuevo.
  const target = useMemo(() => computeGeometryCenter(geometry), [geometry]);

  return (
    <div
      role="img"
      aria-label={`Vista 3D del modelo del ${mobLabel} de Minecraft, con controles de camara orbitales`}
      style={{ width: '100%', height: '100%' }}
    >
      <Canvas camera={{ position: [45, 40, 65], fov: 40, near: 0.1, far: 1000 }}>
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
        <MobModel texture={texture} geometry={geometry} />
        <OrbitControls target={target} enableDamping />
      </Canvas>
    </div>
  );
}
