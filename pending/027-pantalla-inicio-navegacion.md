# 027 — Pantalla de inicio + navegación Home/Editor (HU-1)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-1, Diseño técnico "Navegación Home ↔ Editor").

## Alcance
- `App.tsx` gana un estado `view: 'home' | 'editor'` (sin router — ver justificación en el documento de definición).
- Pantalla de inicio nueva (`HomeScreen.tsx` o similar) con dos entradas: "Selección de mob" (muestra el catálogo, ya existente vía `MobSelector`) y "Guardados" (placeholder simple en este ticket — la lista completa con búsqueda/filtro es el ticket 028; aquí solo el punto de entrada y la navegación).
- Botón "Volver al inicio" visible en el header del editor -- cambia `view` a `'home'` sin resetear `bufferCache` (ticket 018, debe sobrevivir el viaje de ida y vuelta).
- Al elegir un mob desde "Selección de mob", `view` cambia a `'editor'` con ese mob activo (mismo comportamiento de carga de asset base ya existente).

## Qué NO hacer
- No implementar todavía la búsqueda/filtro/orden de "Guardados" (ticket 028) — solo el botón de entrada y que al elegir un proyecto guardado abra el editor.
- No introducir `react-router` ni URLs navegables — la navegación es estado interno.

## Verificación
- En vivo (Claude in Chrome): confirmar que la app abre en la pantalla de inicio (no directo al editor), que "Selección de mob" lleva al catálogo y luego al editor, que "Volver al inicio" regresa sin perder el buffer de un mob ya pintado en la sesión (repetir la verificación de aislamiento de buffer ya usada en el ticket 018, ahora cruzando por Home en el medio).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que abro la app, cuando carga, entonces veo la pantalla de inicio, no el editor.
- Dado que elijo un mob y pinto algo, cuando vuelvo al inicio y vuelvo a entrar al mismo mob, entonces mi pintura sigue ahí.
