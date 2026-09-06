import type { ReactNode } from 'react';

export interface SectionProps {
  /** Título de la tarjeta -- opcional (algunas secciones del panel, ej. una sola acción, no necesitan título propio). */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Tarjeta/agrupador visual (ticket 025) -- unidad del grid del panel
 * reorganizado (ticket 029: "Color", "Vista", "Simetría", etc. son cada
 * una un `Section`). Puramente presentacional, sin estado propio.
 */
export function Section({ title, children, className }: SectionProps) {
  const classes = ['ui-section', className].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      {title ? <h3 className="ui-section__title">{title}</h3> : null}
      {children}
    </section>
  );
}
