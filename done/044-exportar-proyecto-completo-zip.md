# 044 — Exportar proyecto completo como .zip

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-4, "Diseño técnico" — nueva función en `export.ts`). Depende del ticket 041 (vista de detalle de Proyecto, de donde se dispara esta acción).

## Alcance
- Nueva función en `frontend/src/export.ts` (ej. `exportProjectZip(mobs: Map<mobId, {buffer, uvBoxes}>)`) que itera TODOS los mobs del proyecto activo y arma un único `.zip` con la textura de cada uno, empaquetada como resource pack válido — reusa `maskPixelsOutsideUVBoxes`/el mismo mecanismo de codificación por mob ya usado (ticket 015), sin duplicar esa lógica.
- Conectada a la acción "Exportar proyecto (.zip)" de la vista de detalle de Proyecto (ticket 041).
- **Reemplaza** la exportación actual de "solo el mob activo" (`exportResourcePackZip` de un solo buffer) — se retira esa opción del editor (cambio de comportamiento intencional, ya señalado en el documento de definición, regla 9 de CLAUDE.md).

## Qué NO hacer
- No dejar coexistiendo la opción vieja de exportar un solo mob "por si acaso" — el documento de definición decidió explícitamente que se reemplaza, no que coexistan.

## Verificación
- En vivo (Claude in Chrome): con un proyecto de 3 mobs con contenido pintado, exportar el proyecto completo y confirmar (decodificando el zip, o revisión de código si la descarga real requiere permiso explícito del usuario en el entorno de automatización) que el `.zip` contiene las 3 texturas, cada una válida como resource pack.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado un proyecto con varios mobs, cuando elijo "Exportar proyecto (.zip)", entonces descargo un único `.zip` con la textura de cada mob del proyecto.
- Dado que busco la opción de exportar solo el mob activo (como existía antes), entonces ya no está disponible — solo existe la exportación del proyecto completo.

## Hecho

Implementado tal como estaba alcanzado, con una decisión real no especificada explícitamente por el ticket:

- **`exportPack.ts`**: `SKELETON_PNG_PATH` (hardcodeado, gap real que sobrevivió desde el ticket 006 sin que nada lo ejercitara) reemplazado por `entityTexturePngPath(mobId)` -- convenio vanilla `assets/minecraft/textures/entity/<mobId>/<mobId>.png` para los 4 mobs del catálogo. `buildResourcePackFiles` generalizado de un solo `pngBytes` a `ResourcePackMobInput[]` (N mobs).
- **Decisión real**: en vez de reconstruir cada mob a `TextureBuffer` y volver a codificar a PNG (lo que sugería el ticket, `Map<mobId, {buffer, uvBoxes}>`), se reusa DIRECTO el `pngDataUrl` ya guardado por proyecto (ya pasó por el masking del ticket 015 al guardarse) -- nueva `dataUrlToBytes` (pura, usa `atob`) lo decodifica a bytes crudos sin canvas/Image. Menos trabajo, un solo lugar donde el masking puede desalinearse.
- **`export.ts`**: `exportResourcePackZip` (un solo mob, ticket 006/HU-11) **eliminada** -- reemplazada por `exportProjectZip(projectName, mobs)`. `DEFAULT_PACK_DESCRIPTION` deja de mencionar "Esqueleto".
- **`ExportControls.tsx`**: pierde el botón "Exportar pack (.zip)" -- solo queda "Exportar PNG" (HU-10, sin cambios, fuera de alcance de este ticket).
- **`Proyecto.tsx`**: "Exportar proyecto (.zip)" ya no está `disabled`, wireado a `exportProjectZip`.
- **`projectZipFilename(projectName)`** (nueva, pura): slug del nombre del proyecto (sin acentos, minúsculas, guiones), con fallback a `"proyecto"` si normaliza a vacío -- evita que descargas de proyectos distintos se pisen bajo el mismo nombre fijo que tenía el export de un solo mob.

Tests: 197/197 en verde (9 nuevos en `exportPack.spec.ts`: `entityTexturePngPath`, `buildResourcePackFiles` multi-mob y con lista vacía, `dataUrlToBytes` con round-trip real de `btoa`/`atob`, `projectZipFilename` con acentos/símbolos/nombre vacío). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): se sembró un proyecto de 3 mobs con PNGs reales (Esqueleto=rojo, Zombie=verde, Creeper=azul) directo en `localStorage`. Se confirmó que "Exportar proyecto (.zip)" ya no está deshabilitado; se interceptó `URL.createObjectURL`/`click` (sin completar ninguna descarga real a disco) para inspeccionar el `Blob` producido: contiene exactamente `pack.mcmeta` + las 3 texturas en sus rutas vanilla reales (`assets/minecraft/textures/entity/<mob>/<mob>.png`), `pack.mcmeta` parseado con los 3 campos en 75 y la descripción nueva, y `zombie.png` inflado/decodificado con `<img>`+canvas real dio exactamente el pixel verde sembrado -- confirma que cada mob exporta su propio contenido real, no el de otro. Se confirmó además que el editor ya no tiene ningún botón de zip de un solo mob (`find`: único match "Exportar PNG").

Sin hallazgos de QA pendientes.
