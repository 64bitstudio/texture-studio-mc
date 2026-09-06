import type { ReactNode, SVGProps } from 'react';

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
 * "Configuración" (topbar) -- trazo fino (`LineIcon`), NO relleno
 * sólido.
 *
 * Ticket 050 (corrección de Marco, esta vez con una imagen de
 * referencia directa -- ver `docs/ARQUITECTURA.md`, "Ticket 050"): las
 * dos revisiones anteriores (046: relleno con agujero por `evenodd`;
 * 049: relleno con 8 dientes rectangulares) se equivocaron de estilo
 * -- la referencia real es un contorno de 6 pétalos REDONDEADOS
 * (trazo fino, sin relleno) con un aro chico suelto en el centro, sin
 * radios que lo conecten a los pétalos.
 *
 * El contorno se generó PARAMÉTRICAMENTE (Python, no a mano): una
 * curva polar `r(θ) = R_prom + R_amp·cos(6θ)` (6 = número de pétalos)
 * muestreada cada 7.5° (48 puntos) -- una flor de 6 lóbulos perfecta
 * por construcción matemática, con `strokeLinejoin="round"` para que
 * el trazo grueso suavice los segmentos rectos entre puntos en algo
 * visualmente indistinguible de una curva real a este tamaño.
 */
export function IconSettings(props: IconProps) {
  return (
    <LineIcon strokeWidth={1.9} strokeLinejoin="round" {...props}>
      <polygon points="20.95,12.00 20.42,13.11 19.15,13.92 17.82,14.41 17.07,14.93 17.00,15.84 17.23,17.23 17.17,18.74 16.48,19.75 15.25,19.85 13.92,19.15 12.82,18.25 12.00,17.85 11.18,18.25 10.08,19.15 8.75,19.85 7.53,19.75 6.83,18.74 6.77,17.23 7.00,15.84 6.93,14.93 6.18,14.41 4.85,13.92 3.58,13.11 3.05,12.00 3.58,10.89 4.85,10.08 6.18,9.59 6.93,9.08 7.00,8.16 6.77,6.77 6.83,5.26 7.52,4.25 8.75,4.15 10.08,4.85 11.18,5.75 12.00,6.15 12.82,5.75 13.92,4.85 15.25,4.15 16.48,4.25 17.17,5.26 17.23,6.77 17.00,8.16 17.07,9.07 17.82,9.59 19.15,10.08 20.42,10.89" />
      <circle cx={12} cy={12} r={1.35} />
    </LineIcon>
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

/** "Buscar proyectos" (Mis proyectos, ticket 053) -- trazo fino, confirmado contra la referencia (lupa simple, sin relleno). */
export function IconSearch(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="m20 20-4.8-4.8" />
    </LineIcon>
  );
}

/**
 * Menú de acciones "⋮" de una tarjeta de proyecto (Mis proyectos, ticket
 * 053) -- 3 puntos RELLENOS apilados, confirmado contra la referencia
 * (recorte ampliado: puntos sólidos, no un trazo).
 */
export function IconDots(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <circle cx={12} cy={5.5} r={1.9} />
      <circle cx={12} cy={12} r={1.9} />
      <circle cx={12} cy={18.5} r={1.9} />
    </FilledIcon>
  );
}

/**
 * Vista de cuadrícula (toggle grid/lista, Mis proyectos, ticket 053) --
 * 4 cuadrados RELLENOS con esquinas redondeadas, confirmado contra la
 * referencia.
 */
export function IconGridView(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <rect x={3} y={3} width={8} height={8} rx={1.8} />
      <rect x={13} y={3} width={8} height={8} rx={1.8} />
      <rect x={3} y={13} width={8} height={8} rx={1.8} />
      <rect x={13} y={13} width={8} height={8} rx={1.8} />
    </FilledIcon>
  );
}

/**
 * Vista de lista (toggle grid/lista, Mis proyectos, ticket 053) -- trazo
 * fino, 3 filas de "punto + línea", confirmado contra la referencia.
 */
export function IconListView(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx={4.5} cy={6} r={1} fill="currentColor" stroke="none" />
      <path d="M9 6h11" />
      <circle cx={4.5} cy={12} r={1} fill="currentColor" stroke="none" />
      <path d="M9 12h11" />
      <circle cx={4.5} cy={18} r={1} fill="currentColor" stroke="none" />
      <path d="M9 18h11" />
    </LineIcon>
  );
}

/** Botón "Editar" de una tarjeta de proyecto (Mis proyectos, ticket 053) -- lápiz de trazo fino, confirmado contra la referencia. */
export function IconPencil(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 20 4.6 16.3 15 5.9a1.6 1.6 0 0 1 2.3 0l0.8 0.8a1.6 1.6 0 0 1 0 2.3L7.7 19.4Z" />
      <path d="m13.5 7.4 3.1 3.1" />
    </LineIcon>
  );
}

/**
 * Logo pixel-art de bloque de pasto -- REEMPLAZADO en la revisión 2 de
 * este ticket por el PNG real que mandó Marco (`assets/brand/logo.png`,
 * ver `Sidebar.tsx`) -- este componente queda sin uso, se elimina en el
 * mismo commit (ver `docs/ARQUITECTURA.md`, "Ticket 046").
 */
