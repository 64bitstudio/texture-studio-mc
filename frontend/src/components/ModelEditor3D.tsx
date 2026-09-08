import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import { Button } from '../ui';
import { IconHand, IconModel, IconPlus, IconRefresh, IconScale, IconTrash } from '../ui/icons';
import { computeGeometryCenter } from '../geometry/geometryBounds';
import { addBox, canDeleteBox, removeBox, updateBoxTransform } from '../geometry/modelEditing';
import type { MobBoxPart, MobGeometry } from '../types/baseAssets';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Mismos colores/config de piso que `Viewer3D.tsx` (ticket 051/052) -- consistencia visual entre el editor de modelo y el visor de textura, sin duplicar el ajuste fino de esos valores. */
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

type TransformMode = 'translate' | 'rotate' | 'scale';

interface EditableBoxProps {
  name: string;
  part: MobBoxPart;
  selected: boolean;
  onSelect: (name: string, object: THREE.Object3D) => void;
}

/**
 * Una caja editable del modelo -- SIN textura ni mapeo UV (a diferencia
 * de `Viewer3D.tsx`/`MobPartMesh`): la Etapa 1 (modelado) ocurre ANTES
 * de pintar (Etapa 3), así que no hay nada que texturizar todavía. Un
 * color plano (resaltado si está seleccionada) es suficiente para ver
 * la forma mientras se modela.
 *
 * A diferencia de `MobPartMesh` (que solo aplica `rotation` cuando hay
 * `pivot`, ver ese componente), acá SÍ se aplica `rotation` directo
 * sobre la propia caja sin pivote -- una caja recién creada en este
 * editor gira alrededor de su propio centro (no hay jerarquía de huesos
 * todavía, eso es el ticket 084).
 */
function EditableBox({ name, part, selected, onSelect }: EditableBoxProps) {
  const [rx = 0, ry = 0, rz = 0] = part.rotation ?? [0, 0, 0];

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(name, event.object);
  };

  return (
    <mesh
      position={part.position}
      rotation={[rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD]}
      scale={[1, 1, 1]}
      onClick={handleClick}
      userData={{ partName: name }}
    >
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={selected ? '#4ade80' : '#4b6b58'} />
    </mesh>
  );
}

export interface ModelEditor3DProps {
  mobLabel: string;
  projectName: string;
  /** Geometría de partida (vainilla, ver ticket 083 HU-1) -- este componente nunca la muta, solo la usa como estado inicial. */
  baseGeometry: MobGeometry;
  /** "Mis proyectos" en el breadcrumb. */
  onBackToProjectsList: () => void;
  /** Nombre del proyecto en el breadcrumb / "Volver sin guardar". */
  onBackToProject: () => void;
  /**
   * "Continuar" -- entrega la geometría final y si hubo cambios reales
   * respecto a `baseGeometry` (App.tsx decide qué hacer: sin cambios,
   * no persiste nada; con cambios, guarda como `'modelando'` -- la
   * transición formal a `'confirmado'` con atlas UV es el ticket 086,
   * todavía no construido).
   */
  onContinue: (finalGeometry: MobGeometry, hasChanges: boolean) => void;
}

/**
 * Editor de modelo 3D manual (ticket 083, Etapa 1 del epic de modelado
 * 3D -- ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md).
 * Agregar/mover/redimensionar/rotar/eliminar cajas sobre una geometría
 * base, con gizmos en el visor 3D (drei `TransformControls`).
 *
 * DECISIÓN DE ALCANCE de este ticket, señalada explícitamente (no
 * asumida en silencio): la entrada a este editor vive en el menú "⋮" de
 * cada tarjeta de mob en `Proyecto.tsx` ("Editar modelo 3D"), NO
 * inyectada en el flujo principal de "agregar mob" (que seguiría
 * exactamente igual que hoy para cualquiera que no toque esta opción
 * nueva). Forzar a TODOS los usuarios a pasar por un editor de modelo
 * cuyo siguiente paso natural (confirmar + generar atlas UV, ticket
 * 086) todavía no existe habría sido una regresión de UX real -- este
 * enfoque dejar la funcionalidad disponible y probable hoy, sin romper
 * el flujo por defecto mientras el resto del epic (084/086) se termina
 * de construir.
 */
export function ModelEditor3D({ mobLabel, projectName, baseGeometry, onBackToProjectsList, onBackToProject, onContinue }: ModelEditor3DProps) {
  const [geometry, setGeometry] = useState<MobGeometry>(baseGeometry);
  const [originalPartNames] = useState<Set<string>>(() => new Set(Object.keys(baseGeometry.parts)));
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [mode, setMode] = useState<TransformMode>('translate');
  const [isDragging, setIsDragging] = useState(false);

  const hasChanges = geometry !== baseGeometry;
  const canDeleteSelected = selectedName !== null && canDeleteBox(selectedName, originalPartNames);
  const cameraTarget = useMemo(() => computeGeometryCenter(geometry), [geometry]);

  function handleSelect(name: string, object: THREE.Object3D) {
    setSelectedName(name);
    setSelectedObject(object);
  }

  function handlePointerMissed() {
    setSelectedName(null);
    setSelectedObject(null);
  }

  function handleAddBox() {
    const { geometry: next, name } = addBox(geometry);
    setGeometry(next);
    setSelectedName(name);
    setSelectedObject(null); // Se re-selecciona por click real (la nueva caja todavia no tiene un `THREE.Object3D` montado hasta el proximo render).
  }

  function handleDeleteSelected() {
    if (!selectedName || !canDeleteSelected) return;
    setGeometry((current) => removeBox(current, selectedName));
    setSelectedName(null);
    setSelectedObject(null);
  }

  function handleTransformCommit() {
    setIsDragging(false);
    if (!selectedName || !selectedObject) return;

    if (mode === 'translate') {
      const { x, y, z } = selectedObject.position;
      setGeometry((current) => updateBoxTransform(current, selectedName, { position: [x, y, z] }));
      return;
    }

    if (mode === 'rotate') {
      const { x, y, z } = selectedObject.rotation;
      setGeometry((current) =>
        updateBoxTransform(current, selectedName, {
          rotation: [x * RAD_TO_DEG, y * RAD_TO_DEG, z * RAD_TO_DEG],
        }),
      );
      return;
    }

    // mode === 'scale': el gizmo escala el `Object3D`, no la geometria
    // -- se convierte a un tamaño absoluto nuevo (tamaño actual * factor
    // de escala acumulado en este arrastre) y se resetea el `scale` del
    // objeto a 1 (la caja siempre se renderiza con `scale={[1, 1, 1]}`
    // explicito, ver `EditableBox` -- el proximo arrastre de escala
    // vuelve a partir de 1, sin acumular error entre sesiones).
    const currentPart = geometry.parts[selectedName];
    if (!currentPart) return;
    const [w, h, d] = currentPart.size;
    const { x: sx, y: sy, z: sz } = selectedObject.scale;
    const newSize: [number, number, number] = [Math.max(0.5, w * sx), Math.max(0.5, h * sy), Math.max(0.5, d * sz)];
    setGeometry((current) => updateBoxTransform(current, selectedName, { size: newSize }));
  }

  return (
    <div className="ts-fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <nav aria-label="Ruta" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBackToProjectsList} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            Mis proyectos
          </button>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={onBackToProject} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            {projectName}
          </button>
          <span aria-hidden="true">›</span>
          <span style={{ color: 'var(--text)' }}>Editar modelo 3D — {mobLabel}</span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button onClick={onBackToProject}>Volver sin guardar</Button>
          <Button variant="primary" onClick={() => onContinue(geometry, hasChanges)}>
            Continuar
          </Button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconModel size={22} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{mobLabel}</h2>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap' }}>
          Editor de modelo — sin textura todavía
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={mode === 'translate' ? 'primary' : 'secondary'} onClick={() => setMode('translate')} title="Mover">
          <IconHand size={16} /> Mover
        </Button>
        <Button variant={mode === 'rotate' ? 'primary' : 'secondary'} onClick={() => setMode('rotate')} title="Rotar">
          <IconRefresh size={16} /> Rotar
        </Button>
        <Button variant={mode === 'scale' ? 'primary' : 'secondary'} onClick={() => setMode('scale')} title="Escalar">
          <IconScale size={16} /> Escalar
        </Button>
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
        <Button onClick={handleAddBox}>
          <IconPlus size={16} /> Agregar caja
        </Button>
        <Button variant="danger" onClick={handleDeleteSelected} disabled={!canDeleteSelected} title={!selectedName ? 'Selecciona una caja' : !canDeleteSelected ? 'Las cajas de la geometría vainilla no se pueden eliminar' : 'Eliminar caja seleccionada'}>
          <IconTrash size={16} /> Eliminar caja
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, flex: 1, minHeight: 420 }}>
        <div
          role="img"
          aria-label={`Editor de modelo 3D del ${mobLabel} -- agregar, mover, redimensionar y rotar cajas`}
          style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}
        >
          <Canvas camera={{ position: [45, 40, 65], fov: 40, near: 0.1, far: 1000 }} onPointerMissed={handlePointerMissed}>
            <color attach="background" args={['#0f171d']} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[40, 60, 40]} intensity={0.6} />
            <Grid position={[0, 0, 0]} args={[300, 300]} {...FLOOR_GRID_PROPS} />

            {Object.entries(geometry.parts).map(([name, part]) => (
              <EditableBox key={name} name={name} part={part} selected={name === selectedName} onSelect={handleSelect} />
            ))}

            {selectedObject && (
              <TransformControls
                object={selectedObject}
                mode={mode}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={handleTransformCommit}
              />
            )}

            <OrbitControls target={cameraTarget} enableDamping enabled={!isDragging} />
          </Canvas>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Cajas del modelo</h3>
          {Object.keys(geometry.parts).map((name) => {
            const isOriginal = originalPartNames.has(name);
            const isSelected = name === selectedName;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedName(name)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--chip-bg)' : 'var(--surface-raised)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-sm)',
                }}
              >
                {name}
                {isOriginal && <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}> (vainilla)</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
