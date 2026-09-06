import type { ReactNode, SVGProps } from 'react';

// Set de íconos de línea fina (ticket 046) -- dibujados a mano, SIN
// librería externa (decisión explícita de Marco, ver
// `pending/046-...md`/`docs/ARQUITECTURA.md`, "Ticket 046"): mismo
// criterio "todo hand-rolled" que el resto de `ui/` (sin dependencias
// de UI de terceros en todo el proyecto). Convención compartida: 24x24
// viewBox, trazo `currentColor` de 1.8px, sin relleno -- así cada
// ícono hereda el color de texto/acento de quien lo use (mismo truco
// que ya usa `--accent`/`--text` en el resto del sistema de diseño),
// sin necesitar una prop de color por ícono.
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function LineIcon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** "Nuevo proyecto" (sidebar) / "Crear proyecto" (botón). */
export function IconPlus(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </LineIcon>
  );
}

/** "Mis proyectos" (sidebar). */
export function IconFolder(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h9A1.5 1.5 0 0 1 21 9.2V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />
    </LineIcon>
  );
}

/** "Recientes" (sidebar). */
export function IconClock(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={12} cy={12} r={8.25} />
      <path d="M12 7.5V12l3 2" />
    </LineIcon>
  );
}

/** Toggle de tema -> claro (mostrado cuando el tema activo es oscuro). */
export function IconSun(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </LineIcon>
  );
}

/** Toggle de tema -> oscuro (mostrado cuando el tema activo es claro). */
export function IconMoon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M20 13.6A8.4 8.4 0 1 1 10.4 4a6.6 6.6 0 0 0 9.6 9.6Z" />
    </LineIcon>
  );
}

/** "Configuración" (topbar). */
export function IconSettings(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 13.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.7a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.4a1.7 1.7 0 0 0 1.04-1.56V4.3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10.4a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
    </LineIcon>
  );
}

/** Encabezado "Selecciona un mob" (Nuevo proyecto). */
export function IconCube(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </LineIcon>
  );
}

/** Encabezado "Vista previa" (Nuevo proyecto). */
export function IconEye(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx={12} cy={12} r={2.75} />
    </LineIcon>
  );
}

/** Badge de mob seleccionado (Nuevo proyecto) -- trazo más grueso, se usa chico. */
export function IconCheck(props: IconProps) {
  return (
    <LineIcon strokeWidth={2.4} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </LineIcon>
  );
}

/** Callout "vista previa aproximada" (Nuevo proyecto). */
export function IconInfo(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={12} cy={12} r={8.25} />
      <path d="M12 11v5.5" />
      <circle cx={12} cy={7.75} r={0.25} fill="currentColor" stroke="none" />
    </LineIcon>
  );
}

/** Botón "limpiar" del campo de nombre (Nuevo proyecto). */
export function IconX(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </LineIcon>
  );
}

/**
 * Logo pixel-art de bloque de pasto (sidebar: marca superior + tarjeta
 * de pie) -- a diferencia de los íconos de línea de arriba, este es de
 * TRAZO relleno (imita el bloque icónico de Minecraft: cara superior
 * verde, laterales tierra con "flecos" de pasto) -- no encaja en el
 * mismo patrón `LineIcon` (sin trazo, varios colores fijos en vez de
 * `currentColor` único), así que no reusa ese helper.
 */
export function IconGrassBlockLogo({ size = 24, ...rest }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <rect width={24} height={24} rx={5} fill="#5b3a21" />
      <rect y={13} width={24} height={11} rx={0} fill="#5b3a21" />
      <path d="M0 5a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v6H0Z" fill="#5fa832" />
      <g fill="#4f9028">
        <rect x={0} y={9} width={3} height={3} />
        <rect x={6} y={10} width={3} height={3} />
        <rect x={13} y={9} width={3} height={3} />
        <rect x={19} y={10} width={3} height={3} />
        <rect x={3} y={2} width={3} height={2} />
        <rect x={11} y={1} width={3} height={2} />
        <rect x={17} y={3} width={3} height={2} />
      </g>
    </svg>
  );
}
