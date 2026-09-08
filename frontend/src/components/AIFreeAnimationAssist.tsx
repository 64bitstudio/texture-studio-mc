import { useState } from 'react';
import { requestAiProposal } from '../api/aiAssist';
import { buildFreeAnimationPrompt, validateFreeAnimationProposal, type FreeAnimationWarning } from '../animation/aiAnimationProposal';
import { Button, InlineError, Section } from '../ui';
import { IconClipboardPaste, IconCopy, IconLightbulb } from '../ui/icons';
import type { MobAnimation } from '../projectStorage';
import type { MobGeometry } from '../types/baseAssets';

type AssistMode = 'automatico' | 'manual';

export interface AIFreeAnimationAssistProps {
  geometry: MobGeometry;
  /** La propuesta ya confirmada por el usuario (ver flujo de aplicar/descartar abajo) -- reemplaza cualquier animación existente con el MISMO nombre, sin tocar las demás (HU-12: "sin reemplazar animaciones existentes de otro nombre"). */
  onApply: (animation: MobAnimation) => void;
}

/**
 * Asistencia de IA para HU-12 (animación libre, experimental) -- ver
 * `AIPresetParamsAssist.tsx` para HU-11. Mismos dos modos que el resto
 * de asistentes de IA del epic (tickets 088/089/091-HU11), con el mismo
 * flujo de confirmación explícita que `AIColorAssist` (ticket 089):
 * una propuesta válida NO se aplica sola -- se muestra para revisión
 * (nombre/duración/loop + advertencias de coherencia) y el usuario
 * decide "Aplicar" o "Descartar" (HU-12: "descartar la propuesta deja
 * el timeline como estaba").
 */
export function AIFreeAnimationAssist({ geometry, onApply }: AIFreeAnimationAssistProps) {
  const [mode, setMode] = useState<AssistMode>('automatico');
  const [description, setDescription] = useState('');
  const [pastedResponse, setPastedResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ animation: MobAnimation; warnings: FreeAnimationWarning[] } | null>(null);

  const trimmedDescription = description.trim();
  const prompt = trimmedDescription ? buildFreeAnimationPrompt(geometry, trimmedDescription) : '';

  function runValidation(raw: unknown) {
    const result = validateFreeAnimationProposal(raw, geometry);
    if (!result.ok) {
      setError(result.error);
      setPending(null);
      return;
    }
    setError(null);
    setPending({ animation: result.animation, warnings: result.warnings });
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.warn('[AIFreeAnimationAssist] no se pudo copiar el prompt al portapapeles:', err);
      setError('No se pudo copiar el prompt automáticamente -- selecciónalo y cópialo a mano.');
    }
  }

  function handleValidatePasted() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pastedResponse);
    } catch (err) {
      console.warn('[AIFreeAnimationAssist] el texto pegado no es JSON valido:', err);
      setError('El texto pegado no es JSON válido -- copia la respuesta completa de la IA, sin texto extra alrededor.');
      setPending(null);
      return;
    }
    runValidation(parsed);
  }

  async function handleGenerateAutomatic() {
    setError(null);
    setPending(null);
    setLoading(true);
    try {
      const raw = await requestAiProposal('animation', prompt);
      runValidation(raw);
    } catch (err) {
      console.warn('[AIFreeAnimationAssist] fallo generando animacion libre con IA:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido generando la propuesta.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmApply() {
    if (!pending) return;
    onApply(pending.animation);
    setPending(null);
  }

  function handleDiscardPending() {
    setPending(null);
  }

  return (
    <Section
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconLightbulb size={16} /> Animación libre con IA (experimental)
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
          Describe la animación completa que quieres
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setPending(null);
            }}
            placeholder='Ej. "un salto exagerado hacia adelante", "cojear del lado derecho"'
            rows={2}
            style={{ fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={mode === 'automatico' ? 'primary' : 'secondary'} onClick={() => setMode('automatico')}>
            Automático
          </Button>
          <Button variant={mode === 'manual' ? 'primary' : 'secondary'} onClick={() => setMode('manual')}>
            Puente manual
          </Button>
        </div>

        {mode === 'automatico' ? (
          <Button variant="primary" onClick={handleGenerateAutomatic} disabled={!trimmedDescription || loading}>
            {loading ? 'Generando…' : 'Generar con IA'}
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button onClick={handleCopyPrompt} disabled={!trimmedDescription} title="Copia el prompt para pegarlo en Claude, ChatGPT o Gemini directamente">
              <IconCopy size={16} /> {copied ? 'Prompt copiado' : 'Copiar prompt'}
            </Button>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
              Pega aquí la respuesta de la IA
              <textarea
                value={pastedResponse}
                onChange={(e) => {
                  setPastedResponse(e.target.value);
                  setPending(null);
                }}
                placeholder='{"name": "...", "loop": false, "length": 1, "bones": { ... }}'
                rows={4}
                style={{ fontSize: 12, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', resize: 'vertical' }}
              />
            </label>
            <Button variant="primary" onClick={handleValidatePasted} disabled={!pastedResponse.trim()}>
              <IconClipboardPaste size={16} /> Validar propuesta
            </Button>
          </div>
        )}

        {error && <InlineError message={error} />}

        {pending && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--chip-bg)' }}>
            <p role="status" style={{ margin: 0, fontSize: 'var(--font-xs)' }}>
              Propuesta válida: «{pending.animation.name}» ({pending.animation.length.toFixed(2)}s{pending.animation.loop ? ', loop' : ''}), anima {Object.keys(pending.animation.bones).length} hueso(s).
            </p>
            {pending.warnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--warning, #d9a441)' }}>Advertencias de coherencia (no bloquean, revisa antes de aplicar):</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                  {pending.warnings.map((w, i) => (
                    <li key={i}>
                      «{w.boneName}» en {w.time.toFixed(2)}s: {w.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={handleConfirmApply}>
                Aplicar al timeline
              </Button>
              <Button onClick={handleDiscardPending}>Descartar</Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
