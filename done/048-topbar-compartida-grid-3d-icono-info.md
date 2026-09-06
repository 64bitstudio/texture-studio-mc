# 048 — Topbar compartida, cuadrícula 3D real e ícono de info corregido

## Objetivo
Tercera pasada de corrección visual sobre el rediseño de topbar/sidebar/"Nuevo proyecto" (tickets 046/047). Marco confirmó "todo está perfecto" y pidió 3 detalles puntuales más -- alcance explícitamente **solo visual**.

Pedido textual de Marco (verbatim, resumido):
1. El logo superior debe estar en una topbar, igual que los íconos de tema/configuración/perfil (hoy el logo vive arriba del sidebar, los íconos en un header aparte que no cruza todo el ancho).
2. El render (visor 3D) debe tener una cuadrícula igual que la imagen de referencia.
3. El ícono de info de "Esta es solo una vista previa..." es diferente y más grande en la referencia.

## Alcance
- `AppShell.tsx`: nueva topbar COMPARTIDA que cruza todo el ancho de la ventana (logo a la izquierda, tema/Configuración/avatar a la derecha) -- el `Sidebar` y el contenido pasan a vivir DEBAJO de esa topbar, no al costado.
- `Sidebar.tsx`: pierde su bloque de marca superior (se mudó a la topbar) -- conserva la tarjeta de marca del pie.
- `Viewer3D.tsx` (componente compartido -- Editor/AgregarMobs/NuevoProyecto se benefician todos): cuadrícula 3D real (`<Grid>` de `@react-three/drei`) en vez del truco de CSS detrás del canvas del ticket 046 (quedaba tapado por el fondo opaco de la escena).
- `ui/icons.tsx`: `IconInfo` rediseñado como badge relleno (círculo gris claro + "i" oscura), más grande -- antes trazo fino chico.

## Qué NO hacer
- Mismo alcance de las 3 áreas ya tocadas por 046/047 -- no se extiende a `AgregarMobs`/`MobSelector`/`Mis proyectos`/`Recientes`/`Proyecto`/`Editor`/`Settings`, salvo el beneficio incidental de la cuadrícula 3D real (que SÍ es un componente compartido, `Viewer3D.tsx`, y por lo tanto afecta también al visor del Editor -- mejora, no regresión).

## Verificación
- En vivo (Claude in Chrome, ambos temas): topbar compartida cruzando todo el ancho en ambas pantallas de ejemplo ("Nuevo proyecto"/"Mis proyectos"); cuadrícula 3D visible en el visor de "Nuevo proyecto" Y en el Editor (componente compartido); ícono de info comparado contra la referencia.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que abro cualquier pantalla con `AppShell` (no el editor), cuando veo la topbar, entonces el logo y los 3 íconos (tema/Configuración/avatar) están en la MISMA barra, cruzando todo el ancho de la ventana.
- Dado que veo el visor 3D (en "Nuevo proyecto" o en el Editor), cuando el modelo carga, entonces hay una cuadrícula visible bajo sus pies.
- Dado que veo el callout "Esta es solo una vista previa...", entonces su ícono es un círculo relleno con una "i" adentro, más grande que antes.

## Hecho

Implementado tal como estaba alcanzado -- ver `docs/ARQUITECTURA.md`, "Ticket 048" para el detalle técnico completo:

- **Topbar compartida** (`AppShell.tsx`): reestructurado de "fila (sidebar + contenido)" a "columna (topbar + fila (sidebar + contenido))" -- el logo se mudó del `Sidebar` a esta topbar nueva, que sigue tokens de tema (a diferencia del `Sidebar`, no lleva la imagen fija-oscura de Marco, así que no tiene el bug de contraste del ticket 047).
- **`Sidebar.tsx`**: pierde el bloque de marca superior; `height: '100%'` (antes `'100vh'`).
- **Cuadrícula 3D real** (`Viewer3D.tsx`): `<Grid>` de `@react-three/drei` dentro de la escena -- reemplaza el truco de CSS del ticket 046 que quedaba tapado por el fondo opaco de la escena. Componente compartido -- también mejora el visor del Editor (verificado en vivo, sin romper nada).
- **`IconInfo`** (`ui/icons.tsx`): badge relleno (círculo gris + "i" oscura), tamaño default 28 (antes 20, trazo fino).

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local, ambos temas): topbar compartida confirmada cruzando todo el ancho en "Nuevo proyecto"/"Mis proyectos", en ambos temas (tema claro sin bugs de contraste, la topbar sigue el tema activo correctamente). Cuadrícula 3D confirmada visible con recorte ampliado en "Nuevo proyecto" Y en el Editor. Ícono de info confirmado como badge relleno más grande. Sin errores de consola.

Sin hallazgos de QA pendientes.
