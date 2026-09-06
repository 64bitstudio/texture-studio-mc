import { useId, type ReactNode, type SVGProps } from 'react';

// Set de íconos (ticket 046) -- dibujados a mano, SIN librería externa
// (decisión explícita de Marco, ver `docs/ARQUITECTURA.md`, "Ticket
// 046"): mismo criterio "todo hand-rolled" que el resto de `ui/`.
//
// Revisión 2 (mismo ticket, corrección solicitada por Marco: "todos
// los iconos no tienen el estilo correcto"): la referencia NO usa un
// único estilo de ícono -- se verificó píxel a píxel (recortes
// ampliados con Python/PIL de la imagen original) que MEZCLA dos
// estilos reales:
// - Íconos de INFORMACIÓN/navegación neutra (carpeta, reloj, ojo, info,
//   limpiar) -- trazo fino (`LineIcon`, sin cambios de la revisión 1).
// - Íconos de ACCIÓN/marca (sol, engranaje, más, cubo de "Selecciona un
//   mob") -- FORMA RELLENA (sólida), no trazo. Confundir estos dos
//   estilos fue exactamente el hallazgo de Marco.
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

function FilledIcon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/**
 * "Nuevo proyecto" (ícono de la caja activa del sidebar) / "Crear
 * proyecto" (ícono dentro del círculo del botón) -- FORMA RELLENA
 * (cruz sólida), no trazo -- la referencia muestra un "+" grueso y
 * nítido, no una línea fina.
 */
export function IconPlus(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z" />
    </FilledIcon>
  );
}

/** "Mis proyectos" (sidebar) -- trazo fino, confirmado contra la referencia. */
export function IconFolder(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h9A1.5 1.5 0 0 1 21 9.2V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />
    </LineIcon>
  );
}

/** "Recientes" (sidebar) -- trazo fino, confirmado contra la referencia. */
export function IconClock(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={12} cy={12} r={8.25} />
      <path d="M12 7.5V12l3 2" />
    </LineIcon>
  );
}

/**
 * Toggle de tema -> claro (tema activo oscuro) -- FORMA RELLENA (sol
 * sólido con rayos en cuña), no trazo fino como la revisión 1.
 */
export function IconSun(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <circle cx={12} cy={12} r={4.4} />
      <path d="M12 1.5c.6 0 1 .5.9 1.1l-.3 2.4a.6.6 0 0 1-1.2 0l-.3-2.4c-.1-.6.4-1.1.9-1.1ZM12 22.5c-.6 0-1-.5-.9-1.1l.3-2.4a.6.6 0 0 1 1.2 0l.3 2.4c.1.6-.4 1.1-.9 1.1ZM22.5 12c0 .6-.5 1-1.1.9l-2.4-.3a.6.6 0 0 1 0-1.2l2.4-.3c.6-.1 1.1.4 1.1.9ZM1.5 12c0-.6.5-1 1.1-.9l2.4.3a.6.6 0 0 1 0 1.2l-2.4.3c-.6.1-1.1-.4-1.1-.9ZM19.4 4.6c.4.4.4 1 0 1.4l-1.7 1.7a.6.6 0 0 1-.9-.9l1.7-1.7c.4-.4 1-.4.9-.5ZM4.6 19.4c-.4-.4-.4-1 0-1.4l1.7-1.7a.6.6 0 0 1 .9.9l-1.7 1.7c-.4.4-1 .4-.9.5ZM19.4 19.4c-.4.4-1 .4-1.4 0l-1.7-1.7a.6.6 0 0 1 .9-.9l1.7 1.7c.4.4.4 1 .5.9ZM4.6 4.6c.4-.4 1-.4 1.4 0l1.7 1.7a.6.6 0 0 1-.9.9L5.1 5.5c-.4-.4-.4-1-.5-.9Z" />
    </FilledIcon>
  );
}

/** Toggle de tema -> oscuro (tema activo claro) -- trazo fino (confirmado, la referencia no lo muestra pero mantiene el criterio general de íconos "neutros"). */
export function IconMoon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M20 13.6A8.4 8.4 0 1 1 10.4 4a6.6 6.6 0 0 0 9.6 9.6Z" />
    </LineIcon>
  );
}

/**
 * "Configuración" (topbar) -- FORMA RELLENA (engranaje sólido con
 * agujero central), no trazo fino.
 *
 * Ticket 049 (corrección de Marco: "el ícono de configuración se ve
 * apachurrado"): la revisión anterior era un único `<path>` con
 * coordenadas escritas a mano -- fácil de desalinear sin querer
 * (exactamente lo que pasó, quedó asimétrico/aplastado). Reemplazado
 * por una construcción GEOMÉTRICA repetible: un círculo central +
 * 8 dientes idénticos (rectángulos redondeados) rotados en incrementos
 * exactos de 45° alrededor del centro (`transform="rotate(...)"`) --
 * garantiza simetría perfecta por construcción, no por precisión de
 * dedo. El agujero central se logra con una `<mask>` real (blanco
 * visible, negro oculto) en vez de "pintar" un círculo del color del
 * fondo -- funciona sin importar qué haya detrás del ícono.
 */
export function IconSettings({ size = 20, ...rest }: IconProps) {
  const maskId = useId();
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect x={0} y={0} width={24} height={24} fill="white" />
        <circle cx={12} cy={12} r={3.1} fill="black" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx={12} cy={12} r={6.3} />
        {teeth.map((angle) => (
          <rect key={angle} x={10.35} y={1.1} width={3.3} height={4.6} rx={1.2} transform={`rotate(${angle} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}

/**
 * "Selecciona un mob" (encabezado de sección) -- FORMA RELLENA, cubo
 * isométrico de 3 caras con sombreado propio -- a diferencia del resto
 * de íconos, NO usa `currentColor` (siempre se muestra en el mismo
 * verde de marca en la referencia, sin importar dónde se use, igual
 * que `IconGrassBlockLogo`) -- 3 tonos fijos, no theming por variable.
 */
export function IconCube({ size = 20, ...rest }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="#0f171d" />
      <path d="M12 2 21 7l-9 5-9-5Z" fill="#8ff5bd" />
      <path d="M3 7v10l9 5v-10Z" fill="#3fcf8a" />
      <path d="M21 7v10l-9 5v-10Z" fill="#1fa66b" />
    </svg>
  );
}

/** "Vista previa" (encabezado de sección) -- trazo fino, confirmado contra la referencia (blanco/neutro, sin caja ni relleno de acento). */
export function IconEye(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx={12} cy={12} r={2.75} />
    </LineIcon>
  );
}

/** Badge de mob seleccionado (Nuevo proyecto) -- trazo grueso, se usa chico dentro de un círculo sólido. */
export function IconCheck(props: IconProps) {
  return (
    <LineIcon strokeWidth={2.6} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </LineIcon>
  );
}

/**
 * Callout "vista previa aproximada" (Nuevo proyecto). Ticket 048
 * (corrección de Marco: "el ícono de info... es diferente y más
 * grande"): la revisión 1 lo había hecho de trazo fino, chico,
 * `currentColor` -- la referencia (recorte ampliado) muestra un badge
 * RELLENO -- círculo sólido gris claro con una "i" oscura adentro, más
 * grande. Colores FIJOS (no `currentColor`) por el mismo motivo que
 * `IconCube`/`IconGrassBlockLogo`: en la referencia este badge se ve
 * siempre igual, no es un ícono que deba adaptarse al texto de quien
 * lo use. `size` default sube de 20 a 28.
 */
export function IconInfo({ size = 28, ...rest }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <circle cx={12} cy={12} r={12} fill="#8b93a1" />
      <rect x={10.75} y={6.5} width={2.5} height={2.5} rx={1.25} fill="#0f171d" />
      <rect x={10.75} y={10.5} width={2.5} height={7} rx={1.25} fill="#0f171d" />
    </svg>
  );
}

/** Botón "limpiar" del campo de nombre (Nuevo proyecto) -- trazo fino, se usa dentro de un círculo con borde propio (ver el botón que lo envuelve). */
export function IconX(props: IconProps) {
  return (
    <LineIcon strokeWidth={1.6} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </LineIcon>
  );
}

/**
 * Logo pixel-art de bloque de pasto -- REEMPLAZADO en la revisión 2 de
 * este ticket por el PNG real que mandó Marco (`assets/brand/logo.png`,
 * ver `Sidebar.tsx`) -- este componente queda sin uso, se elimina en el
 * mismo commit (ver `docs/ARQUITECTURA.md`, "Ticket 046").
 */
