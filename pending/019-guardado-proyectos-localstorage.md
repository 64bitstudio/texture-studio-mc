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
