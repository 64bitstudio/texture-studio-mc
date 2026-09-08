import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import { AIGeometryAssist } from './AIGeometryAssist';
import { Button, InlineError } from '../ui';
import { IconHand, IconModel, IconPlus, IconRefresh, IconScale, IconTrash } from '../ui/icons';
import { computeGeometryCenter } from '../geometry/geometryBounds';
import { applyDefaultHierarchy, getDescendants, hasAnyHierarchy, setParent } from '../geometry/hierarchy';
import { addBox, canDeleteBox, removeBox, updateBoxTransform } from '../geometry/modelEditing';
import { confirmModelGeometry } from '../geometry/packBoxesUV';
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

interface EditableBoxGroupProps {
  name: string;
  part: MobBoxPart;
  selected: boolean;
  onSelect: (name: string, object: THREE.Object3D) => void;
  registerRef: (name: string, object: THREE.Object3D | null) => void;
  children?: React.ReactNode;
}

/**
 * Una caja editable del modelo, como un `<group>` que representa su
 * propio "hueso" (ticket 084) -- las hijas se pasan como `children` de
 * REACT, anidadas DENTRO de este mismo `<group>` de three.js. Por
 * construcción del scene graph, mover/rotar este grupo (via el gizmo)
 * arrastra automáticamente a todos los grupos hijos anidados adentro,
 * sin lógica de sincronización manual -- ver `hierarchy.ts` para la
 * decisión de que `position`/`rotation` de una caja con `parentId` son
 * relativos a su padre (no absolutos), que es justo lo que hace que
 * esto funcione: el `position` de three.js de un objeto anidado YA es
 * relativo a su padre en el scene graph por definición.
 *
 * SIN textura ni mapeo UV (a diferencia de `Viewer3D.tsx`/`MobPartMesh`):
 * la Etapa 1 (modelado) ocurre ANTES de pintar (Etapa 3).
 *
 * El click usa `event.eventObject` (el objeto que TIENE el handler --
 * este `<group>`), no `event.object` (el objeto realmente intersectado,
 * que sería el `<mesh>` interior) -- necesitamos el GRUPO para que
 * `TransformControls` mueva/rote el hueso completo (con sus hijos), no
 * solo la caja visual.
 */
function EditableBoxGroup({ name, part, selected, onSelect, registerRef, children }: EditableBoxGroupProps) {
  const [rx = 0, ry = 0, rz = 0] = part.rotation ?? [0, 0, 0];

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(name, event.eventObject);
  };

  return (
    <group
      ref={(object) => registerRef(name, object)}
      position={part.position}
      rotation={[rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD]}
      scale={[1, 1, 1]}
      onClick={handleClick}
      userData={{ partName: name }}
    >
      <mesh>
        <boxGeometry args={part.size} />
        <meshStandardMaterial color={selected ? '#4ade80' : '#4b6b58'} />
      </mesh>
      {children}
    </group>
  );
}

interface BoxTreeProps {
  geometry: MobGeometry;
  parentId: string | undefined;
  selectedName: string | null;
  onSelect: (name: string, object: THREE.Object3D) => void;
  registerRef: (name: string, object: THREE.Object3D | null) => void;
}

/** Renderiza recursivamente las cajas cuyo `parentId` sea `parentId` (raíz = `undefined`), anidando sus propias hijas adentro -- ver `EditableBoxGroup`. */
function BoxTree({ geometry, parentId, selectedName, onSelect, registerRef }: BoxTreeProps) {
  const children = Object.entries(geometry.parts).filter(([, part]) => part.parentId === parentId);
  return (
    <>
      {children.map(([name, part]) => (
        <EditableBoxGroup key={name} name={name} part={part} selected={name === selectedName} onSelect={onSelect} registerRef={registerRef}>
          <BoxTree geometry={geometry} parentId={name} selectedName={selectedName} onSelect={onSelect} registerRef={registerRef} />
        </EditableBoxGroup>
      ))}
    </>
  );
}

export interface ModelEditor3DProps {
  mobId: string;
  mobLabel: string;
  projectName: string;
  /** Geometría de partida -- este componente nunca la muta, solo la usa como estado inicial. Si ninguna caja tiene `parentId` (mob vainilla recién cargado, nunca modelado antes), se le aplica la jerarquía por defecto de `mobId` al montar (ticket 084, HU-3). */
  baseGeometry: MobGeometry;
  onBackToProjectsList: () => void;
  onBackToProject: () => void;
  /** "Guardar borrador" (ticket 083) -- sin atlas, sin bloquear nada; el mob sigue en `'modelando'` (o `'vanilla'` si `hasChanges` es `false`) y se puede reabrir este editor despues. */
  onSaveDraft: (finalGeometry: MobGeometry, hasChanges: boolean) => void;
  /**
   * "Confirmar modelo" (ticket 086, HU-6) -- cierra la Etapa 2: la
   * geometria ya viene con el atlas UV aplicado (`confirmModelGeometry`).
   * Bloquea permanentemente este editor para este mob (`geometryStatus:
   * 'confirmado'`) y App.tsx navega directo al editor de textura.
   */
  onConfirm: (confirmedGeometry: MobGeometry) => void;
}

/**
 * Editor de modelo 3D manual (ticket 083) con jerarquía de huesos
 * (ticket 084) -- ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
 * Decisión de alcance sobre dónde vive la entrada a este editor: ver
 * comentario completo en el ticket 083 (`docs/COMPONENTES.md`).
 */
export function ModelEditor3D({ mobId, mobLabel, projectName, baseGeometry, onBackToProjectsList, onBackToProject, onSaveDraft, onConfirm }: ModelEditor3DProps) {
  const [geometry, setGeometry] = useState<MobGeometry>(() => (hasAnyHierarchy(baseGeometry) ? baseGeometry : applyDefaultHierarchy(baseGeometry, mobId)));
  const [originalPartNames] = useState<Set<string>>(() => new Set(Object.keys(baseGeometry.parts)));
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [mode, setMode] = useState<TransformMode>('translate');
  const [isDragging, setIsDragging] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const boxRefs = useRef<Map<string, THREE.Object3D>>(new Map());

  const hasChanges = geometry !== baseGeometry;
  const canDeleteSelected = selectedName !== null && canDeleteBox(selectedName, originalPartNames);
  const cameraTarget = useMemo(() => computeGeometryCenter(geometry), [geometry]);

  function registerBoxRef(name: string, object: THREE.Object3D | null) {
    if (object) {
      boxRefs.current.set(name, object);
    } else {
      boxRefs.current.delete(name);
    }
  }

  function handleSelect(name: string, object: THREE.Object3D) {
    setSelectedName(name);
    setSelectedObject(object);
  }

  function handleSelectFromList(name: string) {
    setSelectedName(name);
    setSelectedObject(boxRefs.current.get(name) ?? null);
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

  function handleSetParent(name: string, parentId: string | null) {
    const result = setParent(geometry, name, parentId);
    if (!result.ok) {
      setHierarchyError(result.error);
      return;
    }
    setHierarchyError(null);
    setGeometry(result.geometry);
    // El objeto tres.js de `name` cambia de grupo padre en el scene graph
    // -- se re-selecciona por nombre (no por referencia vieja) para que
    // el gizmo, si estaba activo, no quede apuntando a un objeto que ya
    // no cuelga de donde antes.
    if (selectedName === name) {
      setSelectedObject(boxRefs.current.get(name) ?? null);
    }
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

    // mode === 'scale': el gizmo escala el `Object3D` (el grupo del
    // hueso completo, incluidas sus hijas mientras se arrastra -- efecto
    // secundario visual aceptado, se autocorrige al soltar) -- se
    // convierte a un tamaño absoluto nuevo (tamaño actual * factor de
    // escala acumulado en este arrastre) y se resetea el `scale` del
    // objeto a 1 (la caja siempre se renderiza con `scale={[1, 1, 1]}`
    // explicito, ver `EditableBoxGroup` -- el proximo arrastre de escala
    // vuelve a partir de 1, sin acumular error entre sesiones).
    const currentPart = geometry.parts[selectedName];
    if (!currentPart) return;
    const [w, h, d] = currentPart.size;
    const { x: sx, y: sy, z: sz } = selectedObject.scale;
    const newSize: [number, number, number] = [Math.max(0.5, w * sx), Math.max(0.5, h * sy), Math.max(0.5, d * sz)];
    setGeometry((current) => updateBoxTransform(current, selectedName, { size: newSize }));
  }

  function handleConfirm() {
    onConfirm(confirmModelGeometry(geometry));
  }

  // La propuesta de IA reemplaza `parts` por completo (ver
  // `validateAndApplyGeometryProposal`) -- una caja seleccionada puede
  // ya no existir (o haber cambiado de identidad), así que se
  // deselecciona en vez de arriesgar un `selectedObject` apuntando a un
  // nombre que ya no está en la geometría nueva.
  function handleApplyAiProposal(nextGeometry: MobGeometry) {
    setGeometry(nextGeometry);
    setSelectedName(null);
    setSelectedObject(null);
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
          <Button onClick={() => onSaveDraft(geometry, hasChanges)} title="Guarda el modelo tal como está, sin generar el atlas de textura -- puedes seguir editándolo después.">
            Guardar borrador
          </Button>
          <Button variant="primary" onClick={handleConfirm} title="Genera el atlas de textura y pasa al editor de textura -- después de esto, la geometría de este mob queda bloqueada.">
            Confirmar modelo
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

      {hierarchyError && <InlineError message={hierarchyError} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, flex: 1, minHeight: 420 }}>
        <div
          role="img"
          aria-label={`Editor de modelo 3D del ${mobLabel} -- agregar, mover, redimensionar y rotar cajas, con jerarquía de huesos`}
          style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}
        >
          <Canvas camera={{ position: [45, 40, 65], fov: 40, near: 0.1, far: 1000 }} onPointerMissed={handlePointerMissed}>
            <color attach="background" args={['#0f171d']} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[40, 60, 40]} intensity={0.6} />
            <Grid position={[0, 0, 0]} args={[300, 300]} {...FLOOR_GRID_PROPS} />

            <BoxTree geometry={geometry} parentId={undefined} selectedName={selectedName} onSelect={handleSelect} registerRef={registerBoxRef} />

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <AIGeometryAssist baseGeometry={geometry} onApply={handleApplyAiProposal} />
          <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Cajas del modelo</h3>
          {Object.entries(geometry.parts).map(([name, part]) => {
            const isOriginal = originalPartNames.has(name);
            const isSelected = name === selectedName;
            const descendants = getDescendants(geometry, name);
            const parentOptions = Object.keys(geometry.parts).filter((candidate) => candidate !== name && !descendants.has(candidate));

            return (
              <div
                key={name}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--chip-bg)' : 'var(--surface-raised)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectFromList(name)}
                  style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--font-sm)' }}
                >
                  {name}
                  {isOriginal && <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}> (vainilla)</span>}
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                  Padre:
                  <select
                    value={part.parentId ?? ''}
                    onChange={(e) => handleSetParent(name, e.target.value === '' ? null : e.target.value)}
                    style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 4px' }}
                  >
                    <option value="">Ninguno (raíz)</option>
                    {parentOptions.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
