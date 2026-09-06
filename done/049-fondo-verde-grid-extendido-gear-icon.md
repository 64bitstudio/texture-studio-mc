# 049 — Fondo verde + cuadrícula extendida del visor 3D, ícono de Configuración corregido

## Objetivo
Cuarta pasada de corrección visual sobre el visor 3D y el ícono de Configuración (tickets 046/047/048). Marco probó el resultado del 048 en vivo y adjuntó una captura de pantalla propia (no del mockup original) señalando 2 problemas puntuales -- alcance explícitamente **solo visual**.

Pedido textual de Marco (verbatim, resumido):
1. El fondo del render 3D debe tener un color verde (hoy es gris neutro).
2. La cuadrícula "debe verse a lo alto" -- hoy solo se ve como un piso cuadriculado chico bajo los pies del mob, no como un piso extenso.
3. El ícono de Configuración (topbar) se ve "apachurrado" (asimétrico/deformado).

## Alcance
- `Viewer3D.tsx`: `<color attach="background">` pasa de gris (`#2b2d36`) a verde oscuro; `<Grid>` (ticket 048) con `args` mucho más grande (el plano físico era demasiado chico para la escala real de la escena, cortaba la cuadrícula antes de que pudiera desvanecerse de forma natural) y `fadeDistance` mayor; colores de la cuadrícula ajustados a un verde que combine con el nuevo fondo.
- `ui/icons.tsx`: `IconSettings` reconstruido con geometría radial exacta (círculo + 8 dientes rotados en incrementos de 45°, agujero central vía `<mask>`) en vez del `<path>` escrito a mano de la revisión anterior (causa real del "apachurrado": coordenadas imprecisas, no un problema de estilo).

## Qué NO hacer
- Mismo alcance ya establecido en 046/047/048 -- el cambio de `Viewer3D.tsx` es un componente compartido (Editor/AgregarMobs/NuevoProyecto se benefician todos, mismo criterio ya aplicado en el ticket 048).

## Verificación
- En vivo (Claude in Chrome): cuadrícula extendida y fondo verde confirmados en "Nuevo proyecto" Y en el Editor (componente compartido); ícono de Configuración comparado de cerca (recorte ampliado) para confirmar simetría real, no aproximada.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que veo el visor 3D con un mob cargado, cuando observo el fondo, entonces es de color verde (no gris).
- Dado que veo el visor 3D, cuando observo la cuadrícula, entonces se extiende visiblemente por buena parte del panel (no solo un parche chico bajo los pies).
- Dado que veo el ícono de Configuración de cerca, entonces es un engranaje simétrico, sin partes deformadas.

## Hecho

Implementado tal como estaba alcanzado -- ver `docs/ARQUITECTURA.md`, "Ticket 049" para el detalle técnico completo:

- **`Viewer3D.tsx`**: fondo de la escena a `#122015` (verde oscuro, antes gris `#2b2d36`). Hallazgo real: el bug de la cuadrícula "chica" del ticket 048 no era conceptual -- `infiniteGrid` desvanece con un shader en espacio de mundo, pero el plano físico subyacente seguía teniendo el tamaño de `args` (`[10,10]`, muy por debajo del área visible a la escala real de la escena) -- fix: `args={[300,300]}` + `fadeDistance` de 110 a 220. Colores de la cuadrícula ajustados a verde (`#3a6b4d`/`#5b9e77`) para combinar con el nuevo fondo.
- **`IconSettings`** (`ui/icons.tsx`): reconstruido con geometría radial exacta (círculo + 8 dientes idénticos rotados 45° c/u vía `transform`, agujero central con `<mask>` + `useId()`) en vez del `<path>` a mano de la revisión anterior -- la causa real del "apachurrado" era precisión de coordenadas, no el concepto del ícono.

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): cuadrícula extendida + fondo verde confirmados con recorte ampliado en "Nuevo proyecto" Y en el Editor (componente compartido, sin errores de consola). Ícono de Configuración confirmado simétrico con recorte ampliado.

Sin hallazgos de QA pendientes.
