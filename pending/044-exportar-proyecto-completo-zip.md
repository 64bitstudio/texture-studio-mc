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
