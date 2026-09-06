# 037 — Shell de navegación nueva (sidebar + header)

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-5, "Diseño técnico" — sin router, sigue aplicando el criterio del ticket 027). Depende de 034/035/036 (tema, acento, configuración) para tener contenido real detrás de los accesos del header.

## Alcance
- `App.tsx` reemplaza el `view: 'home' | 'editor'` binario por un union type más grande: `'nuevo-proyecto' | 'mis-proyectos' | 'recientes' | 'proyecto' | 'agregar-mobs' | 'editor' | 'configuracion'` (los tickets 038-045 implementan el CONTENIDO de cada vista; este ticket construye el ESQUELETO de navegación y deja placeholders donde haga falta).
- Nuevo componente de layout (sidebar fijo a la izquierda: logo/nombre de la app, 3 items de navegación "Nuevo proyecto"/"Mis proyectos"/"Recientes" con el activo resaltado, tarjeta de marca al pie) + header (ícono de tema del ticket 034, ícono de configuración que navega a `'configuracion'`, avatar con la inicial del ticket 036 — sin menú desplegable propio en este ticket, solo navega a Configuración al hacer click).
- Sigue sin router (mismo criterio del ticket 027: no hay necesidad de URLs compartibles/marcables para este flujo de sesión única).

## Qué NO hacer
- No implementar el contenido real de "Nuevo proyecto"/"Mis proyectos"/"Recientes"/"Proyecto"/"Agregar mobs" en este ticket — son placeholders mínimos (o directamente los tickets siguientes, si se hace en el mismo orden). El foco de este ticket es la ESTRUCTURA de navegación en sí.

## Verificación
- En vivo (Claude in Chrome): confirmar que los 3 items del sidebar navegan y resaltan el activo; confirmar que el ícono de configuración navega a esa pantalla; confirmar que el layout es responsive/no se rompe en ventanas angostas (mismo criterio de `auto-fit`/flex ya usado en el resto del proyecto).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado cualquier punto de la app, cuando miro el sidebar, entonces veo los 3 destinos y cuál está activo resaltado visualmente.
- Dado que hago click en el ícono de configuración, entonces navego a la pantalla de Configuración (ticket 036).
- Dado que hago click en el ícono de tema, entonces se comporta igual que el toggle ya construido en el ticket 034 (misma preferencia, sin duplicar lógica).
