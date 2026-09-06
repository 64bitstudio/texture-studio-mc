import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `'secondary'` (default) para acciones normales, `'primary'` para LA
   * acción principal de un flujo, `'icon'` para botones compactos
   * (ícono/símbolo + texto corto), `'danger'` para una acción
   * destructiva ya confirmada en línea (ej. "Sí, eliminar" -- ticket
   * 026, reemplaza el `dangerButtonStyle` ad-hoc que tenía
   * `ProjectControls.tsx`).
   *
   * `'icon-square'` (ticket 046): caja cuadrada de tamaño fijo con SOLO
   * el ícono visible (topbar: tema/Configuración, mockup de
   * referencia) -- a diferencia de `'icon'` (ícono + texto SIEMPRE
   * visible, ticket 032), este variant asume que quien lo usa oculta el
   * texto visualmente con la clase `.sr-only` (nunca lo omite del DOM
   * -- el botón sigue necesitando un nombre accesible real, mismo
   * criterio de ticket 032, solo que ya no se ve en pantalla).
   *
   * `'icon-plain'` (ticket 060, corrección de Marco: "debe ser solo el
   * icono sin el cuadro que lo envuelve"): mismo criterio de accesible-
   * pero-oculto que `'icon-square'` (texto real via `.sr-only`, nunca
   * omitido del DOM), pero SIN el fondo/borde/caja -- solo el ícono,
   * usado en los botones de editar título/descripción de `Proyecto.tsx`.
   */
  variant?: 'secondary' | 'primary' | 'icon' | 'icon-square' | 'icon-plain' | 'danger';
}

/**
 * Botón base del sistema de componentes (ticket 025, HU-4). Wrapper
 * delgado sobre `<button>` nativo -- no reinventa foco/teclado (gratis
 * con el elemento nativo), solo aplica estilo consistente vía las
 * clases `.ui-button*` de `index.css`. `type="button"` por default
 * (nunca "submit" implícito -- este proyecto no usa `<form>` nativos
 * con submit real, todos los controles llaman a su `onClick`/`onChange`
 * directamente).
 */
export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  const variantClass = variant === 'secondary' ? '' : `ui-button--${variant}`;
  const classes = ['ui-button', variantClass, className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
