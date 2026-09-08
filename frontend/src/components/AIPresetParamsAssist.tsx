import { useState } from 'react';
import { requestAiProposal } from '../api/aiAssist';
import { buildPresetParamsPrompt, validateAndClampPresetParams } from '../animation/aiAnimationProposal';
import type { PresetParams } from '../animation/presets';
import type { RecognizedAnimationName } from '../animation/timelineEditing';
import { Button, InlineError } from '../ui';
import { IconClipboardPaste, IconCopy } from '../ui/icons';

type AssistMode = 'automatico' | 'manual';

export interface AIPresetParamsAssistProps {
  preset: RecognizedAnimationName;
  /** Escribe directamente en el mismo estado que los sliders manuales (`AnimationEditor.tsx`) -- HU-11, criterio 3: ajustar a mano después de una propuesta de IA es indistinguible de haberlo hecho desde el inicio. */
  onApply: (params: PresetParams) => void;
}

/**
 * Asistencia de IA para HU-11 (ajuste de parámetros de un preset, no
 * keyframes libres -- ver `AIFreeAnimationAssist.tsx` para HU-12).
 * Mismos dos modos que `AIGeometryAssist`/`AIColorAssist` (tickets
 * 088/089); a diferencia de `AIColorAssist`, una propuesta válida se
 * aplica DE INMEDIATO (criterio explícito de HU-11) -- ajustar
 * `speed`/`amplitude` no sobreescribe nada destructivo, es exactamente
 * lo mismo que mover un slider.
 */
export function AIPresetParamsAssist({ preset, onApply }: AIPresetParamsAssistProps) {
  const [mode, setMode] = useState<AssistMode>('automatico');
  const [description, setDescription] = useState('');
  const [pastedResponse, setPastedResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const trimmedDescription = description.trim();
  const prompt = trimmedDescription ? buildPresetParamsPrompt(preset, trimmedDescription) : '';

  function runValidation(raw: unknown) {
    const result = validateAndClampPresetParams(raw);
    if (!result.ok) {
      setError(result.error);
      setApplied(false);
      return;
    }
    setError(null);
    onApply(result.params);
    setApplied(true);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.warn('[AIPresetParamsAssist] no se pudo copiar el prompt al portapapeles:', err);
      setError('No se pudo copiar el prompt automáticamente -- selecciónalo y cópialo a mano.');
    }
  }

  function handleValidatePasted() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pastedResponse);
    } catch (err) {
      console.warn('[AIPresetParamsAssist] el texto pegado no es JSON valido:', err);
      setError('El texto pegado no es JSON válido -- copia la respuesta completa de la IA, sin texto extra alrededor.');
      setApplied(false);
      return;
    }
    runValidation(parsed);
  }

  async function handleGenerateAutomatic() {
    setError(null);
    setApplied(false);
    setLoading(true);
    try {
      const raw = await requestAiProposal('animation', prompt);
      runValidation(raw);
    } catch (err) {
      console.warn('[AIPresetParamsAssist] fallo sugiriendo parametros con IA:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido generando la propuesta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
        Sugerir velocidad/amplitud con IA
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setApplied(false);
          }}
          placeholder='Ej. "caminar arrastrando los pies", "trote nervioso"'
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
          {loading ? 'Generando…' : 'Sugerir parámetros'}
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
                setApplied(false);
              }}
              placeholder='{"speed": 1, "amplitude": 20}'
              rows={2}
              style={{ fontSize: 12, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', resize: 'vertical' }}
            />
          </label>
          <Button variant="primary" onClick={handleValidatePasted} disabled={!pastedResponse.trim()}>
            <IconClipboardPaste size={16} /> Aplicar
          </Button>
        </div>
      )}

      {error && <InlineError message={error} />}
      {applied && !error && (
        <p role="status" style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>
          Parámetros aplicados -- ajústalos con los sliders si hace falta.
        </p>
      )}
    </div>
  );
}
