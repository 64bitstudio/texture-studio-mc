import type { ComponentType, ReactNode } from 'react';
import { IconFolder, IconPlus, type IconProps } from '../ui/icons';
import logoUrl from '../assets/brand/logo.png';

/**
 * Los 2 destinos reales del sidebar -- 'proyecto'/'configuracion' se
 * alcanzan DESDE estos, no son items propios del sidebar.
 *
 * Pedido de Marco: "Recientes" se retira por completo -- ya no es un
 * destino del sidebar (ver `App.tsx`; `Recientes.tsx` se elimina del
 * repo en el mismo cambio, sin consumidores).
 */
export type NavView = 'nuevo-proyecto' | 'mis-proyectos';

export interface SidebarProps {
  /** `null` cuando la vista activa no corresponde a ningún item del sidebar (ej. dentro de un proyecto, o en Configuración) -- ninguno queda resaltado en ese caso. */
  activeNav: NavView | null;
  onNavigate: (view: NavView) => void;
  /**
   * Contenido extra (ticket 072, pedido de Marco con imagen de
   * referencia): el editor de texturas pasa aquí la tarjeta "Proyecto
   * actual" + la lista de mobs del proyecto -- se renderiza ENTRE los 3
   * items de navegación y la tarjeta de marca del pie, sin que este
   * componente sepa nada de "proyecto" (sigue siendo genérico, mismo
   * criterio del ticket 037/046). `undefined` en el resto de vistas
   * (ninguna otra pantalla pasa este prop todavía).
   */
  extraContent?: ReactNode;
}

const NAV_ITEMS: Array<{ id: NavView; label: string; Icon: ComponentType<IconProps> }> = [
  { id: 'nuevo-proyecto', label: 'Nuevo proyecto', Icon: IconPlus },
  { id: 'mis-proyectos', label: 'Mis proyectos', Icon: IconFolder },
];

// Pedido de Marco: corrige el sidebar en tema claro -- hasta este
// cambio, el fondo era SIEMPRE `#0f171d` fijo (texto SIEMPRE claro a
// juego) sin importar el tema activo. Esa decisión venía del ticket 046
// (`sidebar-bg.png`, un degradado de píxeles verdes SIEMPRE oscuro,
// sin variante clara -- el texto fijo era la única forma de que fuera
// legible sobre esa imagen) -- pero la imagen ya se retiró (pedido de
// Marco, ronda anterior) y el color sólido que quedó en su lugar nunca
// se volvió a evaluar contra el tema claro, dejando el sidebar como un
// bloque oscuro fijo dentro de una app ya clara alrededor. Se retira el
// fijo por completo: el sidebar ahora usa los mismos tokens de tema que
// el resto de la app (`--panel-bg`/`--text`/`--text-dim`/`--border`),
// igual que la topbar compartida (`AppShell.tsx`).
//
// Exportados (ya no como colores fijos, sino como los tokens de tema
// correspondientes) para que `EditorProjectSidebar.tsx` (contenido de
// `extraContent`, vive DENTRO de este mismo `<nav>`) siga los mismos
// criterios sin tener que reimportar los tokens por su cuenta.
export const SIDEBAR_TEXT = 'var(--text)';
export const SIDEBAR_TEXT_DIM = 'var(--text-dim)';

/**
 * Sidebar de navegación (ticket 037, HU-5) -- rediseño visual del
 * ticket 046 según el mockup nuevo entregado por Marco.
 *
 * Revisión 2 del ticket 046 (correcciones pedidas por Marco tras ver
 * el resultado en vivo):
 * - El fondo del sidebar ya NO es un gradiente CSS aproximado -- pasó a
 *   ser el PNG que Marco proveyó (`assets/brand/sidebar-bg.png`), y
 *   MAS TARDE (pedido de Marco, retirar el fondo) un color sólido, y
 *   MAS TARDE AUN (pedido de Marco, "corrige el tema claro para la
 *   sidebar") pasó a seguir los tokens de tema como el resto de la app
 *   -- ver el `<nav>` mas abajo, la imagen ya no se usa ni se importa.
 * - El logo ya NO es el ícono SVG dibujado a mano (`IconGrassBlockLogo`,
 *   eliminado -- ver `ui/icons.tsx`) -- es el PNG real que mandó Marco
 *   (`assets/brand/logo.png`, con transparencia real).
 * - Los items de navegación INACTIVOS ya NO tienen una caja/borde
 *   alrededor del ícono (confirmado contra la referencia, recorte
 *   ampliado: el ícono va suelto, sin caja) -- la caja sólida
 *   (`--accent`, ícono oscuro adentro) es EXCLUSIVA del item activo.
 *
 * Ticket 048 (corrección de Marco): el bloque de marca superior (logo +
 * título + subtítulo) se MUDÓ de aquí a la topbar compartida
 * (`AppShell.tsx`) -- este componente ya no lo renderiza, solo queda
 * el logo chico de la tarjeta de marca al pie. `height: '100%'` (antes
 * `'100vh'`) porque este `<nav>` ya no ocupa la ventana completa desde
 * arriba -- vive DEBAJO de la topbar, dentro de un contenedor flex que
 * le da el alto restante.
 */
export function Sidebar({ activeNav, onNavigate, extraContent }: SidebarProps) {
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        width: 272,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        gap: 4,
        // Pedido de Marco ("corrige el tema claro para la sidebar"):
        // mismo token que la topbar compartida (`AppShell.tsx`), en vez
        // del color sólido fijo que quedó tras retirar la imagen de
        // fondo (ver comentario de `SIDEBAR_TEXT` arriba).
        background: 'var(--panel-bg)',
        borderRight: '1px solid var(--border)',
        height: '100%',
        overflowY: 'auto',
        color: SIDEBAR_TEXT,
      }}
    >
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = activeNav === id;
        return (
          <button
            key={id}
            type="button"
            className={`ui-button ts-nav-item${isActive ? ' ts-nav-item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-lg)',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {isActive ? (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent)',
                  // Fijo (no `var(--text)`/`var(--bg)`) -- mismo criterio que
                  // `.ui-button--primary` (`index.css`): el ícono se apoya
                  // SIEMPRE sobre `--accent`, que es claro en ambos temas, así
                  // que el contraste necesita un oscuro fijo, no uno que seguiría
                  // el tema activo.
                  color: '#0f171d',
                }}
              >
                <Icon size={16} />
              </span>
            ) : (
              <span aria-hidden="true" style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={19} />
              </span>
            )}
            {label}
          </button>
        );
      })}

      {extraContent && <div style={{ marginTop: 8 }}>{extraContent}</div>}

      <div style={{ marginTop: 'auto', paddingTop: 40 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-strong)',
            // Pedido de Marco ("corrige el tema claro para la sidebar"):
            // mismo token de "superficie elevada" que el resto de la
            // app (antes un fijo oscuro semi-opaco, pensado para
            // destacar sobre la imagen de fondo ya retirada).
            background: 'var(--surface-raised)',
          }}
        >
          <img src={logoUrl} alt="" width={28} height={28} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>Texture Studio</div>
            <div style={{ fontSize: 'var(--font-xs)', color: SIDEBAR_TEXT_DIM }}>Crea. Modifica. Comparte.</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
