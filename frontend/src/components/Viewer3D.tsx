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
 * Props compartidas de los 3 planos de la "caja" del visor (piso + 2
 * paredes, ver `Viewer3D`) -- mismos colores/tamaños de celda en los
 * 3 para que combinen entre sí. Ticket 050 (pedido de Marco: "el piso
 * debe ser un verde mas sutil"): tonos más apagados que la revisión
 * anterior del ticket 049 (`cellColor`/`sectionColor` más cerca del
 * fondo de la escena, menos contraste).
 *
 * `side: THREE.DoubleSide` (el `<Grid>` de drei por default usa
 * `THREE.BackSide`, pensado para un piso visto desde arriba) --
 * hallazgo real al agregar las paredes: con `BackSide`, una pared
 * rotada 90° respecto al piso queda con la cara "visible" mirando
 * para el lado contrario a la cámara según la posición/rotación
 * exactas, así que se renderiza invisible (cara trasera). `DoubleSide`
 * la hace visible sin importar la orientación relativa a la cámara --
 * más simple y robusto que calcular a mano qué signo de rotación le
 * toca a cada pared.
 */
const BOX_GRID_PROPS = {
  cellSize: 4,
  cellThickness: 0.7,
  cellColor: '#274435',
  sectionSize: 20,
  sectionThickness: 1.2,
  sectionColor: '#3c6b4f',
  fadeDistance: 220,
  fadeStrength: 1,
  side: THREE.DoubleSide,
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
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }),
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
        {/* Ticket 049 (pedido de Marco: "el fondo del render 3d debe
            tener un color verde") -- verde oscuro (antes gris neutro
            `#2b2d36`), acorde a la paleta de acento de la app sin competir
            con los colores de la textura del mob. */}
        <color attach="background" args={['#122015']} />
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
            Ticket 050 (pedido de Marco: "imagina que el mob esta dentro
            de una caja... falta la pared de la izquierda y de la
            derecha, pero esta debe ser igual cuadriculada como el piso"):
            2 planos verticales más, mismo `<Grid>`, rotados 90° para
            pasar de piso (plano XZ) a pared (planos YZ) -- ver el
            comentario de cada uno abajo para la matemática de la
            rotación. Colores más sutiles que la revisión anterior (pedido
            explícito de Marco sobre el piso, aplicado a los 3 planos para
            que combinen entre sí). */}
        <Grid position={[0, 0, 0]} args={[300, 300]} {...BOX_GRID_PROPS} />
        {/* Pared "izquierda": mismo plano, rotado 90° alrededor del eje
            Z (`rotation={[0, 0, Math.PI / 2]}`) -- un punto del piso
            (x, 0, z) pasa a (0, x, z) en mundo, es decir, el ancho del
            piso (eje X) se vuelve ALTURA (eje Y) y queda fijo en
            mundo-X=0 antes de trasladarlo -- `position={[-40, 0, 0]}`
            lo desplaza a un costado real del modelo. */}
        <Grid position={[-40, 0, 0]} rotation={[0, 0, Math.PI / 2]} args={[300, 300]} {...BOX_GRID_PROPS} />
        {/* Pared "derecha": mismo plano rotado, reflejado al otro lado. */}
        <Grid position={[40, 0, 0]} rotation={[0, 0, Math.PI / 2]} args={[300, 300]} {...BOX_GRID_PROPS} />
        <MobModel texture={texture} geometry={geometry} />
        <OrbitControls target={target} enableDamping />
      </Canvas>
    </div>
  );
}
