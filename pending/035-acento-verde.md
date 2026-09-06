# 035 — Acento verde (reemplaza el morado)

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` ("Diseño técnico" — acento verde). Depende del ticket 034 (tema claro/oscuro) para poder verificar el nuevo acento en ambos temas.

## Alcance
- Reemplaza el valor de `--accent` (hoy `#c084fc`, morado/lila) por un verde, en ambos bloques de tema (`dark`/`light`) del ticket 034. Propuesta de partida del documento de definición: `#4ade80` — ajustable durante la implementación si el contraste real no se ve bien contra alguno de los dos fondos.
- Todo lo que ya usa `--accent` (botones primarios, checkboxes marcados, foco de teclado, spinner de `LoadingOverlay`, radio de mob seleccionado, etc.) se actualiza automáticamente al ser un token — sin tocar cada componente uno por uno.

## Qué NO hacer
- No cambiar ningún otro token de color (fondo, texto, bordes) — solo `--accent`.
- No introducir un segundo tono de verde/variantes — un solo valor de acento, igual que hoy con el morado.

## Verificación
- En vivo (Claude in Chrome), en AMBOS temas (claro/oscuro): capturas de pantalla confirmando que botones primarios, checkboxes, foco de teclado y el mob seleccionado en el selector se ven en verde con buen contraste (texto legible encima).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado cualquier elemento que usa `--accent` (botón primario, checkbox marcado, mob activo en el selector), cuando lo veo en tema oscuro, entonces es verde con contraste legible.
- Dado el mismo tipo de elemento, cuando lo veo en tema claro, entonces también es verde con contraste legible (no el mismo verde exacto si el contraste lo exige, pero de la misma familia).
