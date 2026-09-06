import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { applyBoxUV } from '../geometry/applyBoxUV';
import type { MobGeometry, MobBoxPart } from '../types/baseAssets';

interface MobPartMeshProps {
  part: MobBoxPart;
  textureWidth: number;
  textureHeight: number;
  material: THREE.Material;
}

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

  return <mesh geometry={geometry} material={material} position={part.position} />;
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
  return (
    <div
      role="img"
      aria-label={`Vista 3D del modelo del ${mobLabel} de Minecraft, con controles de camara orbitales`}
      style={{ width: '100%', height: '100%' }}
    >
      <Canvas camera={{ position: [45, 40, 65], fov: 40, near: 0.1, far: 1000 }}>
        <color attach="background" args={['#2b2d36']} />
        <MobModel texture={texture} geometry={geometry} />
        <OrbitControls target={[0, 16, 0]} enableDamping />
      </Canvas>
    </div>
  );
}
