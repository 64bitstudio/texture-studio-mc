import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { applyBoxUV } from '../geometry/applyBoxUV';
import type { SkeletonBaseAssetsResponse, SkeletonBoxPart } from '../types/baseAssets';

interface SkeletonPartMeshProps {
  part: SkeletonBoxPart;
  textureWidth: number;
  textureHeight: number;
  material: THREE.Material;
}

/** Una caja del modelo (cabeza/cuerpo/brazo/pierna) con su UV clasico ya aplicado. */
function SkeletonPartMesh({ part, textureWidth, textureHeight, material }: SkeletonPartMeshProps) {
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

interface SkeletonModelProps {
  data: SkeletonBaseAssetsResponse;
}

function SkeletonModel({ data }: SkeletonModelProps) {
  // useLoader suspende hasta que la textura (data URL base64 devuelta
  // por el backend) termina de decodificarse -- ver el <Suspense> en
  // Viewer3D.
  const texture = useLoader(THREE.TextureLoader, data.texture.dataUrl);

  useEffect(() => {
    // Pixel-art nitido, sin blur ni mipmaps -- HU-1/diseño técnico
    // (ticket 001): magFilter Y minFilter en Nearest (no solo magFilter,
    // que por si solo no evita el blur al alejar la camara).
    //
    // oxlint (react/immutability) marca esto como "modificar el retorno
    // de un hook" -- es una regla generica que no conoce la API de
    // three.js: configurar sampler settings sobre una THREE.Texture ya
    // cargada (mutarla in-place) es el patron idiomatico de three.js/
    // @react-three/fiber (no existe una forma de "clonar con otro
    // filtro" mas barata). Suprimido a proposito, no un silencio de un
    // bug real.
    // oxlint-disable-next-line react/immutability
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }, [texture]);

  const material = useMemo(
    () =>
      // MeshBasicMaterial (sin luces): el objetivo es previsualizar la
      // textura tal cual, sin sombreado que altere los colores -- clave
      // para el editor de pixeles de los tickets siguientes.
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }),
    [texture],
  );

  const { parts, textureWidth, textureHeight } = data.geometry;

  return (
    <group>
      {Object.entries(parts).map(([name, part]) => (
        <SkeletonPartMesh
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
  data: SkeletonBaseAssetsResponse;
}

/**
 * Visor 3D del Esqueleto vanilla (HU-1). Geometria por cajas + UV
 * clasico 64x32, controles de camara orbit/zoom/pan via drei
 * `OrbitControls`. Ver docs/COMPONENTES.md.
 */
export function Viewer3D({ data }: Viewer3DProps) {
  return (
    <div
      role="img"
      aria-label="Vista 3D del modelo del Esqueleto de Minecraft, con controles de camara orbitales"
      style={{ width: '100%', height: '100%' }}
    >
      <Canvas camera={{ position: [45, 40, 65], fov: 40, near: 0.1, far: 1000 }}>
        <color attach="background" args={['#2b2d36']} />
        <Suspense fallback={null}>
          <SkeletonModel data={data} />
        </Suspense>
        <OrbitControls target={[0, 16, 0]} enableDamping />
      </Canvas>
    </div>
  );
}
