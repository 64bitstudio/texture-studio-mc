import type { CSSProperties, ReactNode } from 'react';

export interface SectionProps {
  /** Título de la tarjeta -- opcional (algunas secciones del panel, ej. una sola acción, no necesitan título propio). */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Override puntual (ej. `gridColumn: '1 / -1'` para que una sección ocupe todo el ancho del grid, ticket 029) -- no reemplaza `.ui-section`, se aplica encima. */
  style?: CSSProperties;
}

/**
 * Tarjeta/agrupador visual (ticket 025) -- unidad del grid del panel
 * reorganizado (ticket 029: "Color", "Vista", "Simetría", etc. son cada
 * una un `Section`). Puramente presentacional, sin estado propio.
 */
export function Section({ title, children, className, style }: SectionProps) {
  const classes = ['ui-section', className].filter(Boolean).join(' ');
  return (
    <section className={classes} style={style}>
      {title ? <h3 className="ui-section__title">{title}</h3> : null}
      {children}
    </section>
  );
}
