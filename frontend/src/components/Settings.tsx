import { useCallback, useState, type ChangeEvent } from 'react';
import { Button, FormField, Section, Select } from '../ui';
import { deleteAllProjects } from '../projectStorage';
import { setTheme as applyTheme, type Theme } from '../theme';
import { setUserPrefs } from '../userPrefs';

export interface SettingsProps {
  displayName: string;
  /** Se llama tras guardar un nombre nuevo -- `App.tsx` ya hizo `setUserPrefs`, esto solo actualiza el estado levantado que también lee `Avatar`. */
  onDisplayNameSaved: (displayName: string) => void;
  /**
   * Tema actual + callback -- CONTROLADO desde `App.tsx` (mismo estado
   * levantado que usa `ThemeToggle`, ver ese archivo para el bug real
   * que esto corrige: dos componentes hermanos cambiando la misma
   * preferencia sin una fuente de verdad compartida quedaban
   * desincronizados).
   */
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

/**
 * Pantalla "Configuración" (ticket 036, HU-6; conectada como destino
 * real de navegación en el ticket 037): nombre/avatar local, selector
 * de tema (misma fuente de verdad que el toggle rápido del header,
 * `theme.ts` -- no una preferencia duplicada), y "Borrar todos los
 * datos locales" con confirmación EN LÍNEA (nunca `window.confirm`
 * nativo, ver memoria `texture-studio-mc-sin-dialogos-nativos`).
 *
 * Ticket 037: ya NO es un overlay `position: fixed` propio (como en el
 * ticket 036, cuando todavía no existía un sistema de vistas real) --
 * se renderiza como contenido normal dentro de `<AppShell>` (el sidebar
 * y el header de navegación siguen visibles alrededor, en vez de
 * taparse con un modal).
 */
export function Settings({ displayName, onDisplayNameSaved, theme, onThemeChange }: SettingsProps) {
  const [nameInput, setNameInput] = useState(displayName);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletedAll, setDeletedAll] = useState(false);

  const handleNameInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setNameInput(e.target.value);
  }, []);

  const handleSaveName = useCallback(() => {
    const trimmed = nameInput.trim();
    const finalName = trimmed.length > 0 ? trimmed : 'Usuario';
    setUserPrefs({ displayName: finalName });
    setNameInput(finalName);
    onDisplayNameSaved(finalName);
  }, [nameInput, onDisplayNameSaved]);

  function handleThemeChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Theme;
    applyTheme(next);
    onThemeChange(next);
  }

  function handleConfirmDeleteAll() {
    deleteAllProjects();
    setConfirmDeleteAll(false);
    setDeletedAll(true);
  }

  function handleOpenConfirmDeleteAll() {
    setConfirmDeleteAll(true);
  }

  function handleCancelDeleteAll() {
    setConfirmDeleteAll(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Configuración</h2>

      <Section title="Perfil local">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormField label="Nombre">
            <input
              type="text"
              value={nameInput}
              aria-label="Nombre para mostrar"
              onChange={handleNameInputChange}
              style={{ fontSize: 13, padding: '6px 8px', minWidth: 160 }}
            />
          </FormField>
          <Button onClick={handleSaveName}>Guardar nombre</Button>
        </div>
      </Section>

      <Section title="Tema">
        <FormField label="Apariencia">
          <Select value={theme} onChange={handleThemeChange} aria-label="Tema de la aplicación">
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
          </Select>
        </FormField>
      </Section>

      <Section title="Datos locales">
        {confirmDeleteAll ? (
          <span role="alertdialog" aria-label="Confirmar borrado de todos los datos locales" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>¿Borrar TODOS los proyectos guardados? Esta acción no se puede deshacer.</span>
            <Button variant="danger" onClick={handleConfirmDeleteAll}>
              Sí, borrar todo
            </Button>
            <Button onClick={handleCancelDeleteAll}>Cancelar</Button>
          </span>
        ) : (
          <Button variant="danger" onClick={handleOpenConfirmDeleteAll}>
            Borrar todos los datos locales
          </Button>
        )}
        {deletedAll && (
          <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
            Todos los proyectos guardados se borraron.
          </p>
        )}
      </Section>
    </div>
  );
}
