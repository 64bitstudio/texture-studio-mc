import { useEffect, useMemo, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { applyDefaultHierarchy, hasAnyHierarchy } from '../geometry/hierarchy';
import { resolveLoopedTime, sampleAnimationAtTime, sampleBoneAtTime } from '../animation/interpolation';
import { DEFAULT_PRESET_PARAMS, generatePresetAnimation, type PresetParams } from '../animation/presets';
import { addKeyframe, checkWalkRequiresIdle, createEmptyAnimation, isRecognizedAnimationName, moveKeyframe, removeKeyframe, RECOGNIZED_ANIMATION_NAMES, updateKeyframeValue, ZERO_ROTATION, type RecognizedAnimationName } from '../animation/timelineEditing';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { TextureBuffer } from '../textureBuffer';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { Button, Checkbox, FormField, InlineError, Section, Select } from '../ui';
import { IconPlus, IconRefresh, IconTrash } from '../ui/icons';
import type { AnimationKeyframe, MobAnimation } from '../projectStorage';
import type { MobGeometry, MobTexture } from '../types/baseAssets';

const EMPTY_BUFFER = new TextureBuffer(1, 1);

export interface AnimationEditorProps {
  mobId: string;
  mobLabel: string;
  projectName: string;
  /** Geometría del mob (custom confirmada o vainilla, la misma que ya usa el editor de textura) -- si ninguna caja tiene `parentId` todavía, se le aplica la jerarquía por defecto de `mobId` al montar, mismo criterio que `ModelEditor3D.tsx` (ticket 084). */
  geometry: MobGeometry;
  texture: MobTexture;
  animations: MobAnimation[];
  onBackToProjectsList: () => void;
  onBackToProject: () => void;
  onSaveAnimations: (animations: MobAnimation[]) => void;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

/**
 * Editor de animación (ticket 090, Etapa 4) -- timeline libre de
 * keyframes (HU-10) + presets paramétricos para los 5 nombres que
 * FreeMinecraftModels reconoce (HU-9). Ver
 * docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
 *
 * Reusa el visor 3D existente (`Viewer3D.tsx`, extendido en este mismo
 * ticket con `boneOverrides` y renderizado jerárquico) para la
 * reproducción -- `sampleAnimationAtTime` (puro) traduce la animación
 * seleccionada + el tiempo actual del scrubber a las poses que el
 * visor superpone sobre la geometría base.
 */
export function AnimationEditor({ mobId, mobLabel, projectName, geometry, texture, animations, onBackToProjectsList, onBackToProject, onSaveAnimations }: AnimationEditorProps) {
  const hierarchicalGeometry = useMemo(() => (hasAnyHierarchy(geometry) ? geometry : applyDefaultHierarchy(geometry, mobId)), [geometry, mobId]);
  const boneNames = useMemo(() => Object.keys(hierarchicalGeometry.parts), [hierarchicalGeometry]);

  const [animationsList, setAnimationsList] = useState<MobAnimation[]>(animations);
  const [selectedName, setSelectedName] = useState<string | null>(animations[0]?.name ?? null);
  const selectedAnimation = animationsList.find((a) => a.name === selectedName) ?? null;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [newName, setNewName] = useState('idle');
  const [newLoop, setNewLoop] = useState(true);
  const [newLength, setNewLength] = useState(1);

  const [presetName, setPresetName] = useState<RecognizedAnimationName>('idle');
  const [presetParams, setPresetParams] = useState<PresetParams>(DEFAULT_PRESET_PARAMS);
  const [presetError, setPresetError] = useState<string | null>(null);

  const [selectedBoneName, setSelectedBoneName] = useState<string>(boneNames[0] ?? '');

  const walkWarning = useMemo(() => checkWalkRequiresIdle(animationsList), [animationsList]);

  // Reproduccion: avanza `currentTime` via requestAnimationFrame mientras
  // `isPlaying` -- `setCurrentTime` se despacha desde el callback del
  // propio RAF (asincrono respecto al cuerpo del efecto), mismo criterio
  // que los fetch-then-setState ya establecidos en `App.tsx` (no es el
  // patron "derivar estado sincronicamente en el cuerpo del efecto" que
  // señala `react(set-state-in-effect)`).
  useEffect(() => {
    if (!isPlaying || !selectedAnimation) return;
    const animation = selectedAnimation;
    let rafId = 0;
    let last = performance.now();
    function tick(now: number) {
      const delta = (now - last) / 1000;
      last = now;
      // `resolveLoopedTime` (no un simple `t + delta` sin limite) --
      // hallazgo real visto en vivo durante el QA de este ticket: sin
      // esto, `currentTime` crece sin limite en una animacion en loop
      // (15.28s reproduciendo una animacion de 1s), y aunque el visor
      // 3D ya se veia bien (`sampleAnimationAtTime` envuelve el tiempo
      // internamente), "Agregar keyframe en 15.28s" quedaba fuera del
      // rango real de la animacion -- confuso y generaba keyframes con
      // un `time` sin sentido.
      setCurrentTime((t) => resolveLoopedTime(animation, t + delta));
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, selectedAnimation]);

  // Decodifica el PNG ya pintado UNA vez (mismo patron que `NuevoProyecto.tsx`,
  // `previewBuffer`) -- este editor no pinta, solo reproduce, asi que un
  // `TextureBuffer` de solo lectura alcanza.
  const [previewBuffer, setPreviewBuffer] = useState<TextureBuffer | null>(null);
  useEffect(() => {
    let cancelled = false;
    decodePngDataUrlToImageData(texture.dataUrl, texture.width, texture.height)
      .then((imageData) => {
        if (cancelled) return;
        const buffer = new TextureBuffer(imageData.width, imageData.height);
        buffer.loadFromImageData(imageData);
        setPreviewBuffer(buffer);
      })
      .catch((err: unknown) => {
        console.warn('[AnimationEditor] no se pudo decodificar la textura para la vista previa:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [texture.dataUrl, texture.width, texture.height]);
  const previewTexture = useCanvasTexture(previewBuffer ?? EMPTY_BUFFER, 0);

  const boneOverrides = useMemo(() => (selectedAnimation ? sampleAnimationAtTime(selectedAnimation, currentTime) : undefined), [selectedAnimation, currentTime]);

  function patchAnimation(updated: MobAnimation) {
    setAnimationsList((current) => current.map((a) => (a.name === updated.name ? updated : a)));
  }

  function handleSelectAnimation(name: string) {
    setSelectedName(name);
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function handleDeleteAnimation(name: string) {
    setAnimationsList((current) => current.filter((a) => a.name !== name));
    if (selectedName === name) {
      setSelectedName(null);
      setIsPlaying(false);
    }
  }

  function handleCreateEmpty() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const animation = createEmptyAnimation(trimmed, Math.max(0.1, newLength), newLoop);
    setAnimationsList((current) => [...current.filter((a) => a.name !== trimmed), animation]);
    handleSelectAnimation(trimmed);
  }

  function handleGeneratePreset() {
    setPresetError(null);
    const result = generatePresetAnimation(presetName, mobId, hierarchicalGeometry, presetParams);
    if (!result.ok) {
      setPresetError(`Este preset necesita huesos que este modelo no tiene: ${result.missingBones.join(', ')}.`);
      return;
    }
    setAnimationsList((current) => [...current.filter((a) => a.name !== presetName), result.animation]);
    handleSelectAnimation(presetName);
  }

  function handleAddKeyframeHere() {
    if (!selectedAnimation || !selectedBoneName) return;
    const existing = selectedAnimation.bones[selectedBoneName] ?? [];
    const startingPose = sampleBoneAtTime(existing, currentTime) ?? { rotation: ZERO_ROTATION };
    const keyframe: AnimationKeyframe = { time: Number(currentTime.toFixed(3)), rotation: startingPose.rotation, position: startingPose.position, scale: startingPose.scale };
    patchAnimation(addKeyframe(selectedAnimation, selectedBoneName, keyframe));
  }

  function handleMoveKeyframe(boneName: string, fromTime: number, toTime: number) {
    if (!selectedAnimation) return;
    patchAnimation(moveKeyframe(selectedAnimation, boneName, fromTime, toTime));
  }

  function handleRemoveKeyframe(boneName: string, time: number) {
    if (!selectedAnimation) return;
    patchAnimation(removeKeyframe(selectedAnimation, boneName, time));
  }

  function handleUpdateRotationAxis(boneName: string, time: number, axis: 'x' | 'y' | 'z', value: number) {
    if (!selectedAnimation) return;
    const keyframe = selectedAnimation.bones[boneName]?.find((k) => k.time === time);
    if (!keyframe) return;
    patchAnimation(updateKeyframeValue(selectedAnimation, boneName, time, { rotation: { ...keyframe.rotation, [axis]: value } }));
  }

  const selectedBoneKeyframes = selectedAnimation?.bones[selectedBoneName] ?? [];
  const isNewNameRecognized = isRecognizedAnimationName(newName.trim());

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
          <span style={{ color: 'var(--text)' }}>Editar animaciones — {mobLabel}</span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button onClick={onBackToProject}>Volver sin guardar</Button>
          <Button variant="primary" onClick={() => onSaveAnimations(animationsList)}>
            Guardar animaciones
          </Button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconRefresh size={22} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{mobLabel}</h2>
      </div>

      {walkWarning && <InlineError message={walkWarning} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            role="img"
            aria-label={`Vista previa de la animación del ${mobLabel}`}
            style={{ height: 420, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}
          >
            <Viewer3D texture={previewTexture} geometry={hierarchicalGeometry} mobLabel={mobLabel} boneOverrides={boneOverrides} />
          </div>

          <Section title="Reproducción">
            {selectedAnimation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button variant="primary" onClick={() => setIsPlaying((p) => !p)}>
                    {isPlaying ? 'Pausar' : 'Reproducir'}
                  </Button>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                    {formatSeconds(currentTime)} / {formatSeconds(selectedAnimation.length)} {selectedAnimation.loop ? '(loop)' : ''}
                  </span>
                </div>
                <input type="range" aria-label="Momento de la animación" min={0} max={selectedAnimation.length} step={0.01} value={Math.min(currentTime, selectedAnimation.length)} onChange={(e) => { setIsPlaying(false); setCurrentTime(Number(e.target.value)); }} />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Selecciona o crea una animación para reproducirla.</p>
            )}
          </Section>

          {selectedAnimation && (
            <Section title={`Keyframes -- ${selectedAnimation.name}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormField label="Hueso">
                  <Select value={selectedBoneName} aria-label="Hueso a animar" onChange={(e) => setSelectedBoneName(e.target.value)}>
                    {boneNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <Button onClick={handleAddKeyframeHere} disabled={!selectedBoneName}>
                  <IconPlus size={16} /> Agregar keyframe en {formatSeconds(currentTime)}
                </Button>

                {selectedBoneKeyframes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>«{selectedBoneName}» todavía no tiene keyframes en esta animación.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedBoneKeyframes.map((kf) => (
                      <div key={kf.time} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                          t=
                          <input type="number" aria-label={`Momento del keyframe de ${selectedBoneName} en segundos`} step={0.01} min={0} max={selectedAnimation.length} value={kf.time} onChange={(e) => handleMoveKeyframe(selectedBoneName, kf.time, Number(e.target.value))} style={{ width: 56 }} />
                        </label>
                        {(['x', 'y', 'z'] as const).map((axis) => (
                          <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                            {axis}°
                            <input type="number" aria-label={`Rotación ${axis} en grados del keyframe en ${formatSeconds(kf.time)}`} step={1} value={kf.rotation[axis]} onChange={(e) => handleUpdateRotationAxis(selectedBoneName, kf.time, axis, Number(e.target.value))} style={{ width: 52 }} />
                          </label>
                        ))}
                        <button type="button" className="ui-button ui-button--icon-plain" onClick={() => handleRemoveKeyframe(selectedBoneName, kf.time)} aria-label={`Eliminar keyframe en ${formatSeconds(kf.time)}`}><IconTrash size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Section title="Animaciones de este mob">
            {animationsList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Este mob todavía no tiene animaciones.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {animationsList.map((animation) => (
                  <div
                    key={animation.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${selectedName === animation.name ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedName === animation.name ? 'var(--chip-bg)' : 'var(--surface-raised)',
                    }}
                  >
                    <button type="button" onClick={() => handleSelectAnimation(animation.name)} style={{ textAlign: 'left', flex: 1, background: 'none', border: 'none', padding: 0, color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--font-sm)' }}>
                      {animation.name}
                      <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                        {' '}
                        ({formatSeconds(animation.length)}
                        {animation.loop ? ', loop' : ''})
                      </span>
                      {!isRecognizedAnimationName(animation.name) && <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Solo disparable manualmente por código del servidor.</span>}
                    </button>
                    <button type="button" className="ui-button ui-button--icon-plain" onClick={() => handleDeleteAnimation(animation.name)} aria-label={`Eliminar animación ${animation.name}`}><IconTrash size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Generar desde preset">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FormField label="Preset">
                <Select value={presetName} aria-label="Preset a generar" onChange={(e) => setPresetName(e.target.value as RecognizedAnimationName)}>
                  {RECOGNIZED_ANIMATION_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={`Velocidad (${presetParams.speed.toFixed(2)})`}>
                <input type="range" aria-label="Velocidad del preset" min={0.25} max={3} step={0.05} value={presetParams.speed} onChange={(e) => setPresetParams((p) => ({ ...p, speed: Number(e.target.value) }))} />
              </FormField>
              <FormField label={`Amplitud (${presetParams.amplitude.toFixed(0)}°)`}>
                <input type="range" aria-label="Amplitud del preset" min={5} max={60} step={1} value={presetParams.amplitude} onChange={(e) => setPresetParams((p) => ({ ...p, amplitude: Number(e.target.value) }))} />
              </FormField>
              <Button variant="primary" onClick={handleGeneratePreset}>
                Generar «{presetName}»
              </Button>
              {presetError && <InlineError message={presetError} />}
            </div>
          </Section>

          <Section title="Nueva animación vacía">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FormField label="Nombre">
                <input type="text" aria-label="Nombre de la animación nueva" placeholder="ej. idle, ataque_especial" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </FormField>
              {!isNewNameRecognized && newName.trim() && (
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                  "{newName.trim()}" no es uno de los 5 nombres reconocidos por FreeMinecraftModels ({RECOGNIZED_ANIMATION_NAMES.join(', ')}) -- se guardará igual, pero solo se podrá disparar manualmente por código del lado del servidor.
                </p>
              )}
              <FormField label="Duración (segundos)">
                <input type="number" aria-label="Duración de la animación nueva, en segundos" min={0.1} step={0.1} value={newLength} onChange={(e) => setNewLength(Number(e.target.value))} />
              </FormField>
              <Checkbox checked={newLoop} onChange={setNewLoop}>
                En loop
              </Checkbox>
              <Button onClick={handleCreateEmpty} disabled={!newName.trim()}>
                <IconPlus size={16} /> Crear vacía
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
