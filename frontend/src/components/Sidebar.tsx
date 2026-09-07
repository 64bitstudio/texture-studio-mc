import type { ComponentType, ReactNode } from 'react';
import { IconChevronLeft, IconFolder, IconPlus, type IconProps } from '../ui/icons';
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
  /**
   * Franja de solo iconos (pedido de Marco: "que el sidebar pueda
   * hacerse pequeno"). Colapsado: ancho angosto, SOLO los iconos de
   * navegación (con `title`/`aria-label` para el nombre accesible --
   * la etiqueta visible se oculta con `.sr-only`, no se quita del DOM,
   * mismo criterio que `.ui-button--icon-square`) y `extraContent` NO
   * se renderiza (la tarjeta "Proyecto actual"/lista de mobs no tiene
   * una versión de solo-icono razonable -- confirmado con Marco vía
   * `AskUserQuestion`). El estado en sí vive en `App.tsx`
   * (`sidebarCollapse.ts`, persistido en `localStorage`) -- este
   * componente solo renderiza según el valor recibido, no lo posee.
   */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Ancho expandido (sin cambios, ticket 037/046) vs. colapsado (franja de solo iconos). */
const SIDEBAR_WIDTH_EXPANDED = 272;
const SIDEBAR_WIDTH_COLLAPSED = 76;

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
export function Sidebar({ activeNav, onNavigate, extraContent, collapsed, onToggleCollapsed }: SidebarProps) {
  const collapseToggleLabel = collapsed ? 'Expandir sidebar' : 'Colapsar sidebar';

  return (
    // Wrapper NO scrolleable, ancla real del botón de colapsar/expandir
    // (mas abajo) -- hallazgo real de Marco ("el boton genera un scroll
    // en el sidebar, ademas se corta el boton"): el botón vivía DENTRO
    // del propio `<nav>` (que sí scrollea, `overflowY: 'auto'`),
    // posicionado con `right: -12` para asomar la mitad afuera del
    // borde -- pero la spec de CSS Overflow dice que si UN eje tiene un
    // valor de scroll (`auto`, este caso `overflow-y`) y el otro es
    // `visible`, el navegador computa TAMBIÉN el otro eje (`overflow-x`)
    // como `auto` (mismo mecanismo ya documentado en el comentario de
    // `textureSectionWrapperRef` en `Editor.tsx`, aplicado aca al revés:
    // fijar solo `overflow-y` fuerza `overflow-x` a `auto` tambien) --
    // el fragmento del botón que sobresalía quedaba entonces DENTRO del
    // area de scroll horizontal recien generada, en vez de simplemente
    // visible: aparecía una barra de scroll y el botón se veía cortado
    // (o solo visible arrastrando ese scroll). Sacar el botón del `<nav>`
    // que scrollea -- este wrapper (sin `overflow` propio, `visible` por
    // default) es la posición real del botón, `<nav>` solo scrollea SU
    // contenido interno, sin que nada dentro de el necesite asomarse
    // fuera de su propio borde.
    <div
      style={{
        position: 'relative',
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        flexShrink: 0,
        height: '100%',
        // Transición suave del ancho (pedido de Marco, "animaciones y
        // transiciones a todo", sutiles -- mismo criterio ya aplicado en
        // `index.css` a los botones/hover de este mismo componente).
        transition: 'width var(--transition-fast)',
      }}
    >
      <nav
        aria-label="Navegación principal"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          // Hallazgo real de Marco ("se ve muy amontonado cuando esta
          // pequeno", con captura): colapsado, el primer ícono quedaba
          // pegado en diagonal al botón de colapsar/expandir (que vive
          // en el mismo rincón superior, ver mas abajo) y los 2 íconos
          // de navegación entre sí -- mismo `padding-top`/`gap` que el
          // estado expandido, sin aire extra para lo angosto que es la
          // franja colapsada. Colapsado: mas padding arriba (despeja el
          // botón flotante, que ya no cae encima del primer ícono) y mas
          // separación entre íconos.
          padding: collapsed ? '52px 12px 20px' : 20,
          gap: collapsed ? 10 : 4,
          // Pedido de Marco ("corrige el tema claro para la sidebar"):
          // mismo token que la topbar compartida (`AppShell.tsx`), en vez
          // del color sólido fijo que quedó tras retirar la imagen de
          // fondo (ver comentario de `SIDEBAR_TEXT` arriba).
          background: 'var(--panel-bg)',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          color: SIDEBAR_TEXT,
          boxSizing: 'border-box',
        }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = activeNav === id;
        // Handler nombrado, definido AFUERA del JSX (no
        // `onClick={() => onNavigate(id)}` inline) -- el hook
        // `ui-accessibility-guard.sh` escanea el texto del tag con una
        // regex que corta la "etiqueta de apertura" en el primer `>`
        // literal que encuentra, y una flecha `=>` inline adentro del
        // tag produce ese `>` antes de tiempo (mismo gotcha ya
        // documentado para `onPointerDown={(e) => ...}` en
        // `SelectionOverlay.tsx`/`PasteImageOverlay.tsx`) -- con el
        // handler ya resuelto a una referencia simple, el tag no
        // contiene ningún `=>` que lo confunda.
        const handleClick = () => onNavigate(id);
        return (
          <button key={id} type="button" className={`ui-button ts-nav-item${isActive ? ' ts-nav-item--active' : ''}`} aria-current={isActive ? 'page' : undefined} title={label} onClick={handleClick} style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12, padding: collapsed ? '10px 0' : '10px 12px', borderRadius: 'var(--radius-md)', fontWeight: isActive ? 600 : 500 }}>
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
            {/* Colapsado: la etiqueta se oculta VISUALMENTE (`.sr-only`,
                `index.css`) pero sigue en el DOM -- el botón conserva su
                nombre accesible real (regla de accesibilidad del
                equipo, mismo criterio que `.ui-button--icon-square`), y
                `title` (arriba en el tag de apertura) da el tooltip
                nativo al pasar el mouse mientras está colapsado. */}
            {collapsed ? <span className="sr-only">{label}</span> : label}
          </button>
        );
      })}

      {!collapsed && extraContent && <div style={{ marginTop: 8 }}>{extraContent}</div>}

      <div style={{ marginTop: 'auto', paddingTop: 40 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? 8 : 12,
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
          {/* Colapsado: solo el logo -- el nombre/tagline no entra en
              una franja de 64px sin partirse en varias líneas, y ya
              está disponible en texto completo en la topbar compartida
              (`AppShell.tsx`) sin importar el estado de este sidebar. */}
          {!collapsed && (
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>Texture Studio</div>
              <div style={{ fontSize: 'var(--font-xs)', color: SIDEBAR_TEXT_DIM }}>Crea. Modifica. Comparte.</div>
            </div>
          )}
        </div>
      </div>
      </nav>
      {/* Colapsar/expandir (pedido de Marco: "que el sidebar pueda
          hacerse pequeno") -- flotante sobre el borde derecho del
          sidebar, mismo patrón visual (círculo pequeño, `--panel-bg` +
          borde) ya usado por los botones flotantes de
          `PasteImageOverlay.tsx`/`SelectionOverlay.tsx`, en vez de
          `.ui-button--icon-square` (esa variante es una caja de 40px
          pensada para la topbar, demasiado grande para este handle).
          Vive FUERA del `<nav>` que scrollea (ver comentario del
          wrapper de arriba) -- hallazgo real de Marco.
          TODO en una sola línea (apertura + ícono + cierre) -- gotcha
          real del hook `ui-accessibility-guard.sh`: extrae el match
          completo con newlines y lo divide línea por línea antes de
          buscar `aria-label`, así que un match multilínea reporta un
          falso positivo por cada línea sin el atributo aunque el tag
          de apertura sí lo tenga (ver memoria del equipo, gotcha
          `ui-accessibility-guard-gotchas.md`). */}
      <button type="button" title={collapseToggleLabel} aria-label={collapseToggleLabel} onClick={onToggleCollapsed} style={{ position: 'absolute', top: 16, right: -12, width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--panel-bg)', color: 'var(--text)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}><IconChevronLeft size={14} style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} /></button>
    </div>
  );
}
