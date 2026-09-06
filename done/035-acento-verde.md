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

## Hecho

`--accent` cambiado de `#c084fc` (morado) a `#4ade80` (verde) -- mismo valor en ambos bloques de tema (`[data-theme='dark']`/`[data-theme='light']`), no hizo falta un segundo tono: `--accent` en este proyecto solo se usa como borde o como fondo de `.ui-button--primary` con texto oscuro FIJO, nunca como color de texto sobre el fondo del tema (que sí hubiera exigido ajustar el tono por contraste). Sin cambios de componentes -- todos los usos ya eran `var(--accent)`, ningún hex hardcodeado suelto (confirmado con grep).

Confirmado que el checkbox nativo (`ui/Checkbox.tsx`) no usa `--accent` (nunca tuvo `accent-color` fijado, desde el ticket 026) -- no es una regresión de este ticket, queda fuera de alcance.

Tests: 174/174 en verde (sin tests nuevos -- cambio puramente de valor de token, verificado en vivo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): mob activo del selector, borde de color seleccionado en el picker, y botones primarios confirmados en verde con buen contraste en AMBOS temas (capturas de pantalla).

Sin hallazgos de QA pendientes.
