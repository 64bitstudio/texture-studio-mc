# 019 — Guardado de proyectos por nombre en localStorage

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md` (HU-3, HU-4, HU-5, Diseño técnico). Permite nombrar y guardar el trabajo en curso (de uno o varios mobs) en `localStorage`, y recuperarlo después.

## Depende de
Ticket 018 (selector de mob + buffers por mob en memoria durante la sesión) — un proyecto guardado es, esencialmente, una foto de esos buffers en un momento dado.

## Alcance
- `frontend/src/projectStorage.ts` (nuevo, módulo puro): `saveProject(name, mobsState)`, `loadProject(name)`, `listProjects()`, `deleteProject(name)`. Formato exacto en `docs/definiciones/multi-mob-y-proyectos-guardados.md` (clave `texture-studio-mc:projects`, cada mob como PNG en base64 vía `encodeBufferToPngBlob` ya existente, más `resolution`).
- Al guardar: si el nombre ya existe, pedir confirmación antes de sobrescribir (nunca en silencio).
- Al guardar: si `localStorage.setItem` lanza `QuotaExceededError` (u otra excepción), mostrar un mensaje claro (ej. "No hay espacio suficiente — elimina algún proyecto guardado") — nunca fallar en silencio ni perder el trabajo del usuario en memoria.
- UI: input de nombre + botón "Guardar", lista de proyectos guardados (nombre + fecha) con opciones "Cargar" y "Eliminar" (con confirmación).
- Al cargar un proyecto: reconstruye el/los buffer(s) de cada mob que el proyecto tenía guardado (vía `decodePngDataUrlToImageData`, ya existente) y dejarlos disponibles como los buffers-en-memoria-por-mob del ticket 018 (el mob actualmente activo se actualiza de inmediato; los demás quedan listos para cuando el usuario los seleccione).

## Qué NO construir (fuera de este ticket)
- No persistas el historial de undo/redo (decisión ya confirmada en la definición).
- No sincronices entre dispositivos/navegadores — solo `localStorage` del navegador actual.

## Verificación
- En vivo (Claude in Chrome): pinta algo distintivo en Esqueleto y en Zombie (ticket 017/018), guarda como "prueba-1", recarga la página completa (para simular una sesión nueva), carga "prueba-1", y confirma con `getImageData` que ambos mobs recuperan exactamente lo que se guardó.
- Prueba guardar con un nombre ya existente y confirma que pide confirmación antes de sobrescribir.
- Prueba eliminar un proyecto y confirma que desaparece de la lista y de `localStorage` (`localStorage.getItem('texture-studio-mc:projects')` ya no lo incluye).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
Ver HU-3, HU-4 y HU-5 completas en la definición.

## Hecho

Implementado en PR #42 (`feature/019-guardado-proyectos-localstorage`, mergeado a `dev`, CI Jenkins en verde).

- `frontend/src/projectStorage.ts` (módulo puro): `saveProject`, `loadProject`, `listProjects`, `deleteProject`, `projectExists`. Clave `localStorage["texture-studio-mc:projects"]`, cada mob guardado como PNG base64 (`encodeBufferToPngBlob`) + `resolution`.
- `frontend/src/projectSnapshot.ts`: puente entre el `TextureBuffer` en memoria (por mob, ya introducido en el ticket 018) y el formato serializable del proyecto.
- `frontend/src/components/ProjectControls.tsx`: UI de nombre + "Guardar", lista de proyectos (nombre + fecha) con "Cargar"/"Eliminar", confirmaciones inline (nunca `window.confirm`/`alert`/`prompt` -- ver memoria `texture-studio-mc-sin-dialogos-nativos`, incidente real durante la implementación).
- `decodePngDataUrlToImageData` (en `decodeTexture.ts`) extendido para aceptar `width`/`height` explícitos, necesario para reconstruir buffers guardados en una resolución distinta a la nativa.
- Decisión explícita de Marco (Product Owner) sobre el hallazgo del agente implementador: el guardado reusa el mismo enmascarado de UV-boxes que el export (`maskPixelsOutsideUVBoxes`), es decir, cualquier pixel pintado fuera de las cajas UV conocidas (ej. la región "hat" del esqueleto) se pierde tanto al exportar como al guardar. Alternativa de guardado 100% lossless fue presentada y descartada -- "Guardado igual al export" es el comportamiento buscado.
- Tests: `frontend/test/projectStorage.spec.ts` (203 líneas, cubre guardar/cargar/listar/eliminar y colisión de nombre) -- en verde en CI.
- `npm run lint`, `npm test`, `npm run build` en verde (Jenkins, PR #42).

**Verificación en vivo (Claude in Chrome, DEV, sesión nueva real vía recarga completa + `performance.getEntriesByType('navigation')` confirmado como `navigate`)**:
- Se pintó un pixel distintivo en Esqueleto (15,6) y otro en Zombie -- cara, (12,10) -- dentro de sus respectivas cajas UV, se guardaron juntos en un mismo proyecto ("verificacion-019-multimob"), se recargó la página completa y se cargó el proyecto: `getImageData` confirmó que ambos mobs recuperaron su pixel exacto (`(161,28,17,255)` y `(59,110,165,255)` respectivamente) -- confirma HU-3 (un proyecto = varios mobs a la vez).
- Se probó guardar con un nombre ya existente: aparece confirmación inline "¿Sobrescribir «...»?" antes de sobrescribir (se canceló para no perder el dato de prueba).
- Se probó eliminar un proyecto: confirmación inline "¿Eliminar?", y tras confirmar desapareció tanto de la lista en la UI como de `localStorage.getItem('texture-studio-mc:projects')`.
- Hallazgo NO funcional durante la verificación: la primera recarga de la página tras guardar mostró momentáneamente un estado inconsistente (pixel ya pintado antes de cargar) que resultó ser un glitch transitorio de la herramienta de automatización (una página de error intermedia), no un bug de la aplicación -- confirmado descartando corrupción del lado servidor (`curl` al asset base) y repitiendo la navegación limpiamente. No representa un defecto real del ticket.
