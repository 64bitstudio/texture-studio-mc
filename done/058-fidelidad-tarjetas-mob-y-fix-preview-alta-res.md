# 058 — Bug de preview 2D en alta resolución + fidelidad visual de tarjetas de mob

## Objetivo
Marco comparó su proyecto real ("Galgoth_v1", texturas en resolución
x6) contra la imagen de referencia y señaló dos cosas: (1) la miniatura
del Zombie se ve con ruido de colores mezclados -- un bug real
encontrado al investigar, no un tema de diseño -- y (2) la tarjeta de
mob de `Proyecto.tsx` (ticket 057) todavía difiere bastante del mockup
en varios detalles visuales concretos. Ronda de preguntas ya resuelta
con Marco (`AskUserQuestion`): el menú "⋮" por mob solo necesita
"Eliminar mob del proyecto"; la pestaña "Configuración del proyecto"
se mantiene omitida (decisión del ticket 056 sin cambios).

## Alcance

### Bug real: ruido de color en preview 2D de texturas de alta resolución
`renderMobFrontSprite2D.ts` (ticket 055) arma el canvas de salida en
tamaño "x1" (nativo, chico) y usa `ctx.drawImage` para ENCOGER cada
región de origen (que sí está a la resolución real, ej. x6) hasta ese
tamaño chico -- con `imageSmoothingEnabled = false`, el navegador hace
un muestreo de vecino más cercano al reducir, que para una textura
detallada/con dithering produce ruido visible (cada píxel de destino
"elige" un solo píxel de un bloque de 6x6, no un promedio). Con
texturas x1 planas (los proyectos de prueba usados en el ticket 055)
esto no se notaba porque los bloques de 6x6 no existían.

**Fix**: el canvas de salida debe armarse a la resolución REAL de la
textura (`layout.width * resolution` x `layout.height * resolution`),
con cada `drawImage` copiando 1:1 (mismo tamaño de origen y destino,
sin escalar nada dentro del canvas) -- el sprite resultante conserva
todo el detalle real; quien lo muestre más chico (miniatura de tarjeta,
o más grande en el modal) deja que el navegador escale la imagen ya
completa, en vez de que el propio compositor tire información antes de
tiempo.

### Bug real: el modal de vista previa no escala la imagen hacia arriba
`MobEntryCard.tsx` usa `maxWidth`/`maxHeight` en el `<img>` del modal --
eso solo LIMITA el tamaño, nunca fuerza a agrandar una imagen nativa
chica (confirmado: un sprite nativo de 18x34px se mostraba a 18x34px
real dentro de una caja de 256x256, ilegible). Cambiar a `width`/
`height` (con `objectFit: 'contain'`) para que sí escale hacia arriba.

### Fidelidad visual de la tarjeta de mob (`MobEntryCard.tsx`)
Ajustar contra la imagen de referencia:
- Preview 2D más grande (recorte del mockup: ocupa la mayor parte del
  ancho de la tarjeta, no una miniatura chica en la fila superior).
- Reincorporar el campo "Modelo: <nombre del mob>" en la lista de
  info (archivo/dimensiones/escala/modelo) -- se había omitido en el
  ticket 057 por parecer redundante con el título, pero la referencia
  lo mantiene siempre, y Marco pidió fidelidad visual. Sin agregar
  subtítulo duplicado bajo el título (el título ya es el nombre del
  mob; repetirlo dos veces no aporta información real).
- Ícono de "ojo" como botón cuadrado compacto (icon-square, sin texto
  visible más que el `sr-only`), separado de "Editar textura", igual
  que la referencia -- no como botón con la palabra "Vista previa".
- Menú "⋮" nuevo por tarjeta con una sola acción: "Eliminar mob del
  proyecto" (confirmación inline, sin diálogo nativo).
- Tarjeta "Agregar mob" (borde punteado, ícono "+" grande, mismo texto
  que la referencia) al final de la cuadrícula/lista de mobs, además
  del botón que ya existe en el header (mismo `onAddMobs`).

### `projectStorage.ts`: nueva función `removeMobFromProject`
`removeMobFromProject(projectName, mobId)`: quita esa entrada de
`record.mobs` y guarda -- mismo criterio que `renameProject`
(lee/escribe el registro completo). Si es el ÚLTIMO mob del proyecto,
se permite igual (el proyecto queda vacío de mobs, mismo estado ya
soportado por "Agregar mobs" con 0 mobs) -- no se fuerza eliminar el
proyecto completo, esa es una decisión separada que ya tiene su propio
botón.

## Qué NO hace este ticket
- No agrega la pestaña "Configuración del proyecto" (confirmado que se
  mantiene omitida).
- No agrega "Duplicar textura" al menú ⋮ del mob (confirmado: solo
  Eliminar).
- No toca `Editor.tsx`.
- No corrige la rotación 2D de las patas de la Araña (limitación ya
  conocida y aceptada, ticket 055).

## Criterios de aceptación (TDD)
- Dado un mob guardado con una textura de resolución > x1 y contenido
  detallado, cuando veo su miniatura/preview, entonces se ve nítida y
  fiel a los colores reales -- sin ruido de píxeles mezclados.
- Dado que abro el modal de vista previa, entonces la imagen se ve
  grande (escalada hacia arriba si el sprite nativo es chico), no en su
  tamaño diminuto original.
- Dado una tarjeta de mob, cuando la veo, entonces muestra: preview 2D
  grande, info con archivo/dimensiones/escala/modelo, ícono de ojo
  cuadrado + botón "Editar textura", y un menú "⋮" con "Eliminar mob
  del proyecto".
- Dado que elijo "Eliminar mob del proyecto" y confirmo, entonces ese
  mob desaparece de la lista y del `localStorage` del proyecto, sin
  afectar a los demás mobs.
- Dado el grid/lista de mobs, cuando lo veo, entonces incluye una
  tarjeta "Agregar mob" al final que navega al mismo flujo que el botón
  del header.
- Verificación visual en vivo (Claude in Chrome) con AL MENOS un
  proyecto que tenga una textura de resolución > x1, dark y light
  theme.

## Hecho

Implementado tal como se definió. Todos los criterios de aceptación
cumplidos y verificados en vivo (Claude in Chrome, dark y light theme,
con una textura real de resolución x6).

- `frontend/src/renderMobFrontSprite2D.ts`: fix del bug de ruido de
  color -- canvas de salida armado a resolución real, copia 1:1.
- `frontend/src/components/MobEntryCard.tsx`: preview grande, campo
  "Modelo" reincorporado, ícono de ojo compacto, menú "⋮" con
  "Eliminar mob del proyecto", fix del modal (`width`/`height` fijos en
  px).
- `frontend/src/projectStorage.ts`: nueva función
  `removeMobFromProject`.
- `frontend/src/components/Proyecto.tsx`: tarjeta "Agregar mob" al
  final del grid/lista; conecta `onRemoveMob`/`onMobRemoved`.
- `frontend/src/App.tsx`: nuevo `handleMobRemoved` -- sincroniza
  `activeProject.mobIds`.
- `frontend/test/projectStorage.spec.ts`: 4 tests nuevos.

Tests: 220 pasan (216 + 4 nuevos). `npx tsc --noEmit`, `npm run lint`,
`npm run build` en verde.

**Hallazgos reales durante la implementación** (los tres verificados en
vivo, no solo teorizados):
1. El bug de ruido de color se confirmó y corrigió inyectando una
   textura x6 con dithering fino directo en `localStorage` (sin
   depender del flujo de guardado del editor, que no re-guarda
   ediciones posteriores en el proyecto -- fuera de alcance de este
   ticket, posible ticket aparte si Marco lo necesita).
2. El fix inicial del modal (`width`/`height` en porcentaje) tenía a su
   vez un bug real de CSS (porcentaje de alto no resuelve de forma
   confiable dentro de un `display: grid` con `placeItems: center`) --
   corregido con valores fijos en píxeles. Ver
   `docs/ARQUITECTURA.md`, "Ticket 058".
3. Quitar un mob no sincronizaba `activeProject.mobIds` en `App.tsx` --
   "Agregar mobs" seguía sin ofrecer el mob recién quitado. Corregido
   con un nuevo callback `onMobRemoved`, mismo patrón que
   `onProjectRenamed`/`handleMobsAdded`.

Fuera de alcance (mencionado explícitamente, no una omisión silenciosa):
el editor no tiene ningún mecanismo para volver a guardar una textura
ya editada de vuelta al proyecto (`Editor.tsx` nunca llama a
`saveProject`) -- se descubrió al intentar reproducir el bug editando
resolución en vivo. No es parte del alcance de este ticket; si Marco lo
considera un problema real, amerita su propio ticket.
