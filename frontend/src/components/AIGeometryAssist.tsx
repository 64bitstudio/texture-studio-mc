import { useState } from 'react';
import { requestAiProposal } from '../api/aiAssist';
import { buildGeometryProposalPrompt, validateAndApplyGeometryProposal } from '../geometry/geometryProposal';
import { Button, InlineError, Section } from '../ui';
import { IconClipboardPaste, IconCopy, IconLightbulb } from '../ui/icons';
import type { MobGeometry } from '../types/baseAssets';

type AssistMode = 'automatico' | 'manual';

export interface AIGeometryAssistProps {
  /** Geometría actual del editor -- se serializa en el prompt (ticket 088, `buildGeometryProposalPrompt`) y es la base sobre la que se valida/aplica cualquier propuesta (nuevas cajas heredan placeholder de uv/faceLabels, las existentes conservan las suyas). */
  baseGeometry: MobGeometry;
  /** La propuesta ya validada reemplaza la geometría del editor por completo (ver `validateAndApplyGeometryProposal`) -- quien llama decide qué hacer con ella (en `ModelEditor3D`, `setGeometry`). */
  onApply: (geometry: MobGeometry) => void;
}

/**
 * Asistencia de IA para geometría (ticket 088, HU-4/HU-5). Dos modos que
 * comparten TODO el flujo de validación (`validateAndApplyGeometryProposal`)
 * -- la única diferencia es de dónde sale el JSON de la propuesta:
 *
 * - **Manual** (HU-4, siempre disponible, no requiere backend
 *   configurado): copia el prompt para pegarlo en Claude/ChatGPT/Gemini
 *   directamente, y pega de vuelta la respuesta JSON para aplicarla.
 * - **Automático** (HU-5): llama al proxy del backend (ticket 087, que
 *   sí requiere `GEMINI_API_KEY` configurada en el servidor) sin que el
 *   usuario copie/pegue nada.
 *
 * Si el modo automático falla (API no configurada, error transitorio
 * agotó reintentos, etc.), el mensaje de error del backend ya sugiere
 * "usa el modo puente manual como respaldo" -- este componente no
 * oculta el modo manual en ningún caso, para que ese respaldo siempre
 * esté a mano.
 */
export function AIGeometryAssist({ baseGeometry, onApply }: AIGeometryAssistProps) {
  const [mode, setMode] = useState<AssistMode>('automatico');
  const [description, setDescription] = useState('');
  const [pastedResponse, setPastedResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const trimmedDescription = description.trim();
  const prompt = trimmedDescription ? buildGeometryProposalPrompt(baseGeometry, trimmedDescription) : '';

  function applyRawProposal(raw: unknown) {
    const result = validateAndApplyGeometryProposal(raw, baseGeometry);
    if (!result.ok) {
      setError(result.error);
      setApplied(false);
      return;
    }
    setError(null);
    setApplied(true);
    onApply(result.geometry);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.warn('[AIGeometryAssist] no se pudo copiar el prompt al portapapeles:', err);
      setError('No se pudo copiar el prompt automáticamente -- selecciónalo y cópialo a mano.');
    }
  }

  function handleApplyPasted() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pastedResponse);
    } catch (err) {
      console.warn('[AIGeometryAssist] el texto pegado no es JSON valido:', err);
      setError('El texto pegado no es JSON válido -- copia la respuesta completa de la IA, sin texto extra alrededor.');
      setApplied(false);
      return;
    }
    applyRawProposal(parsed);
  }

  async function handleGenerateAutomatic() {
    setError(null);
    setApplied(false);
    setLoading(true);
    try {
      const raw = await requestAiProposal('geometry', prompt);
      applyRawProposal(raw);
    } catch (err) {
      console.warn('[AIGeometryAssist] fallo generando geometria con IA:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido generando la propuesta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconLightbulb size={16} /> Asistencia de IA
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
          Describe el cambio que quieres
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setApplied(false);
            }}
            placeholder='Ej. "hazlo más musculoso", "dale cuernos", "agrega una cola larga"'
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
            <Button
              onClick={handleCopyPrompt}
              disabled={!trimmedDescription}
              title="Copia el prompt para pegarlo en Claude, ChatGPT o Gemini directamente"
            >
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
                placeholder='{"parts": { ... }}'
                rows={4}
                style={{ fontSize: 12, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', resize: 'vertical' }}
              />
            </label>
            <Button variant="primary" onClick={handleApplyPasted} disabled={!pastedResponse.trim()}>
              <IconClipboardPaste size={16} /> Aplicar propuesta
            </Button>
          </div>
        )}

        {error && <InlineError message={error} />}
        {applied && !error && (
          <p role="status" style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>
            Propuesta aplicada -- revisa las cajas antes de confirmar el modelo.
          </p>
        )}
      </div>
    </Section>
  );
}
