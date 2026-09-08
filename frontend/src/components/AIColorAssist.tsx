import { useState } from 'react';
import { requestAiProposal } from '../api/aiAssist';
import { buildColorProposalPrompt, validateAndApplyColorProposal } from '../geometry/colorProposal';
import { Button, InlineError, Section } from '../ui';
import { IconClipboardPaste, IconCopy, IconLightbulb } from '../ui/icons';
import type { MobGeometry } from '../types/baseAssets';
import type { PixelSource } from '../textureBuffer';

type AssistMode = 'automatico' | 'manual';

export interface AIColorAssistProps {
  geometry: MobGeometry;
  /** Multiplicador de la resolución de trabajo activa (ticket 009) -- la geometría describe el UV en pixeles nativos, ver `validateAndApplyColorProposal`. */
  scale: number;
  /** Se llama recién al validar una propuesta (no en cada render) -- lee el contenido VIGENTE del buffer en ese instante, mismo criterio que `buffer.getRawData()` en `handleImportFile` de `Editor.tsx`. */
  getCurrentPixels: () => PixelSource;
  /** La propuesta ya validada y confirmada por el usuario (ver flujo de confirmación abajo) -- quien llama decide cómo integrarla al historial de deshacer (en `Editor.tsx`, vía `computeFullReplaceDiff` + `PaintHistory`, mismo mecanismo que "Importar imagen"). */
  onApply: (pixels: PixelSource) => void;
}

/**
 * Asistencia de IA para color (ticket 089, HU-8) -- misma estructura de
 * dos modos que `AIGeometryAssist` (ticket 088): **Automático** llama
 * al proxy del backend, **Puente manual** copia el prompt y deja pegar
 * la respuesta. Ambos comparten el mismo flujo de validación
 * (`validateAndApplyColorProposal`).
 *
 * Diferencia deliberada frente a `AIGeometryAssist`: una propuesta
 * válida NO se aplica de inmediato -- HU-8 exige una confirmación
 * explícita antes de sobreescribir píxeles ya pintados a mano. En vez
 * de intentar detectar con precisión "¿esta región específica ya tenía
 * algo pintado?", se pide confirmación SIEMPRE que una propuesta es
 * válida (superset seguro del criterio de aceptación literal -- más
 * simple, y nunca deja pasar el caso que sí importa).
 */
export function AIColorAssist({ geometry, scale, getCurrentPixels, onApply }: AIColorAssistProps) {
  const [mode, setMode] = useState<AssistMode>('automatico');
  const [description, setDescription] = useState('');
  const [pastedResponse, setPastedResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPixels, setPendingPixels] = useState<PixelSource | null>(null);
  const [applied, setApplied] = useState(false);

  const trimmedDescription = description.trim();
  const prompt = trimmedDescription ? buildColorProposalPrompt(geometry, trimmedDescription) : '';

  function runValidation(raw: unknown) {
    const result = validateAndApplyColorProposal(raw, geometry, getCurrentPixels(), scale);
    if (!result.ok) {
      setError(result.error);
      setPendingPixels(null);
      return;
    }
    setError(null);
    setApplied(false);
    setPendingPixels(result.pixels);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.warn('[AIColorAssist] no se pudo copiar el prompt al portapapeles:', err);
      setError('No se pudo copiar el prompt automáticamente -- selecciónalo y cópialo a mano.');
    }
  }

  function handleValidatePasted() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pastedResponse);
    } catch (err) {
      console.warn('[AIColorAssist] el texto pegado no es JSON valido:', err);
      setError('El texto pegado no es JSON válido -- copia la respuesta completa de la IA, sin texto extra alrededor.');
      setPendingPixels(null);
      return;
    }
    runValidation(parsed);
  }

  async function handleGenerateAutomatic() {
    setError(null);
    setPendingPixels(null);
    setLoading(true);
    try {
      const raw = await requestAiProposal('color', prompt);
      runValidation(raw);
    } catch (err) {
      console.warn('[AIColorAssist] fallo generando color con IA:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido generando la propuesta.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmApply() {
    if (!pendingPixels) return;
    onApply(pendingPixels);
    setPendingPixels(null);
    setApplied(true);
  }

  function handleDiscardPending() {
    setPendingPixels(null);
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
          Describe el estilo/color que quieres
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setPendingPixels(null);
            }}
            placeholder='Ej. "piel verde podrida de zombie", "tonos grises de piedra"'
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
                  setPendingPixels(null);
                }}
                placeholder='{"parts": { ... }}'
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

        {pendingPixels && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--chip-bg)' }}>
            <p role="status" style={{ margin: 0, fontSize: 'var(--font-xs)' }}>
              Propuesta válida -- aplicarla sobreescribirá los píxeles ya pintados en las regiones que cubre.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={handleConfirmApply}>
                Aplicar sobre el atlas
              </Button>
              <Button onClick={handleDiscardPending}>Descartar</Button>
            </div>
          </div>
        )}

        {applied && !error && !pendingPixels && (
          <p role="status" style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>
            Color aplicado -- puedes seguir pintando encima con las herramientas normales.
          </p>
        )}
      </div>
    </Section>
  );
}
