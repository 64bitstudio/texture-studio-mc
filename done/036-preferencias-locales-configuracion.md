# 036 — Preferencias locales de usuario + pantalla Configuración

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-6, "Diseño técnico" — perfil local, borrar datos locales). Depende del ticket 034 (tema, para el selector de tema de esta pantalla comparta la misma fuente de verdad que el toggle rápido).

## Alcance
- Nuevo módulo puro `frontend/src/userPrefs.ts`: `getUserPrefs()`/`setUserPrefs({displayName})`, persistido en `localStorage`. Default `displayName: "Usuario"` si nunca se configuró. La inicial del avatar se DERIVA de `displayName` (primera letra, mayúscula) — no es un campo separado.
- Nueva pantalla "Configuración" (alcanzable desde el ícono de engranaje del header, ticket 037 la conecta a la navegación — este ticket puede construirla como componente standalone, verificable con una ruta/estado temporal si 037 aún no existe):
  - Campo para editar `displayName` — el avatar del header se actualiza de inmediato al guardar.
  - Selector de tema (lee/escribe la MISMA preferencia del ticket 034 — una sola fuente de verdad, dos entradas de UI, no una preferencia duplicada).
  - Botón "Borrar todos los datos locales" — nueva función `deleteAllProjects()` en `projectStorage.ts` que limpia únicamente las claves de `localStorage` que usa este proyecto (no todo el storage del origen). Requiere confirmación EN LÍNEA (nunca `window.confirm` nativo, ver memoria `texture-studio-mc-sin-dialogos-nativos`) antes de ejecutar.

## Qué NO hacer
- No construir ningún backend ni cuenta real — todo vive en `localStorage` del navegador, sin login (confirmado explícitamente por Marco en la fase de definición).
- No agregar más preferencias configurables de las 3 listadas (nombre, tema, borrar datos) — cualquier otra idea de configuración queda fuera de este ticket.

## Verificación
- En vivo (Claude in Chrome): cambiar el nombre y confirmar que el avatar del header muestra la nueva inicial de inmediato; cambiar el tema desde Configuración y confirmar que el toggle rápido del header queda sincronizado (y viceversa); hacer click en "Borrar todos los datos locales", confirmar que aparece la confirmación inline (no un diálogo nativo), confirmar, y verificar que `listProjects()` queda vacío.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que cambio mi nombre en Configuración, cuando guardo, entonces el avatar del header muestra la inicial de ese nombre nuevo.
- Dado que cambio el tema desde Configuración, entonces el toggle rápido del header refleja el mismo cambio (una sola preferencia, no dos).
- Dado que hago click en "Borrar todos los datos locales", cuando confirmo en el aviso inline, entonces todos los proyectos guardados desaparecen; si cancelo, entonces no se borra nada.

## Hecho

Implementado tal como estaba alcanzado:

- `userPrefs.ts` (nuevo): `getUserPrefs`/`setUserPrefs`/`getAvatarInitial`, mismo patrón que `theme.ts` (persistencia via `globalThis.localStorage`, default seguro ante valor ausente/corrupto).
- `projectStorage.ts`: `deleteAllProjects()` nuevo, borra solo la clave de proyectos (no toca tema/preferencias).
- `components/Avatar.tsx`/`components/Settings.tsx` (nuevos): montados temporalmente en el header actual (ícono de engranaje + avatar junto al toggle de tema del ticket 034) -- ubicación temporal, el ticket 037 los reubica sin tocar su lógica.

Bug real encontrado y corregido en vivo (no hipotético, reproducido con `textContent` antes del fix): `ThemeToggle` tenía su propio estado interno inicializado una sola vez -- cambiar el tema desde `Settings` (segundo lugar que ahora también lo cambia) no lo actualizaba, el botón rápido del header quedaba mostrando la acción contraria a la real. Corregido levantando `theme` a `App.tsx` (misma solución ya aplicada a `displayName`/`Avatar`): `ThemeToggle` y `Settings` pasan a ser componentes CONTROLADOS (`theme`/`onThemeChange` por props), sin estado propio para esa preferencia.

Tests: 184/184 en verde (incluye `userPrefs.spec.ts` nuevo y 3 tests nuevos de `deleteAllProjects` en `projectStorage.spec.ts` -- `Avatar`/`Settings`, que tocan DOM/overlay, se verificaron en vivo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): cambiar el nombre actualiza el avatar de inmediato; cambiar el tema desde Configuración sincroniza el toggle rápido (bug reproducido y re-verificado corregido); "Borrar todos los datos locales" muestra la confirmación inline (nunca diálogo nativo) y al confirmar la lista de "Guardados" queda vacía.

Sin hallazgos de QA pendientes.
