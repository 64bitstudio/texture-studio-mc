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
            Ticket 049 (hallazgo real, corrección de Marco: "solo se ve
            como si fuera un piso cuadriculado" -- se veía como un parche
            chico bajo los pies, no un piso extenso): `args` pasó de
            `[10, 10]` a `[300, 300]` -- ese valor es el tamaño FÍSICO real
            del plano (aunque `infiniteGrid` desvanezca la cuadrícula
            "al infinito" con un shader, el plano en sí sigue siendo del
            tamaño de `args`; a la escala de esta escena -- cámara a
            ~90 unidades del origen, modelos de decenas de unidades -- un
            plano de 10x10 quedaba MUY por debajo del área visible dentro
            del frustum de la cámara, cortando la cuadrícula mucho antes
            de que pudiera desvanecerse de forma natural). `fadeDistance`
            subió de 110 a 220 para que el desvanecido ocurra recién cerca
            del horizonte visible, no antes. */}
        <Grid
          position={[0, 0, 0]}
          args={[300, 300]}
          cellSize={4}
          cellThickness={0.8}
          cellColor="#3a6b4d"
          sectionSize={20}
          sectionThickness={1.4}
          sectionColor="#5b9e77"
          fadeDistance={220}
          fadeStrength={1}
          infiniteGrid
        />
        <MobModel texture={texture} geometry={geometry} />
        <OrbitControls target={target} enableDamping />
      </Canvas>
    </div>
  );
}
