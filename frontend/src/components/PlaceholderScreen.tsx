export interface PlaceholderScreenProps {
  title: string;
  /** Número de ticket (034-045) donde esta pantalla se implementa de verdad -- ver docs/definiciones/proyectos-y-navegacion.md. */
  ticket: number;
}

/**
 * Placeholder mínimo (ticket 037, "Qué NO hacer" -- el foco de este
 * ticket es la ESTRUCTURA de navegación, no el contenido real de cada
 * pantalla) para los destinos que todavía no tienen implementación
 * propia. Se reemplaza pantalla por pantalla en los tickets 040-042.
 */
export function PlaceholderScreen({ title, ticket }: PlaceholderScreenProps) {
  const ticketId = String(ticket).padStart(3, '0');
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: 'var(--text-dim)' }}>Esta pantalla todavía no está implementada -- ver ticket {ticketId}.</p>
    </div>
  );
}
