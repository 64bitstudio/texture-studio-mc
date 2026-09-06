# 045 — Retiro del flujo de edición libre sin proyecto

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` ("Alcance — No incluye" / "Diseño técnico — cambio de comportamiento señalado explícitamente"). Último ticket del epic — depende de que 037-044 ya cubran el flujo nuevo completo (navegación, crear/abrir proyecto, editar, agregar mobs, exportar).

## Alcance
- Limpieza final: retira cualquier ruta/UI que todavía permita editar la textura de un mob SIN pertenecer a un proyecto (la antigua sección "Selección de mob" de `HomeScreen.tsx`, y cualquier resto del flujo `view: 'home'` binario que no haya sido reemplazado ya en el ticket 037).
- Retira/limpia código muerto que haya quedado de la navegación vieja (componentes, props, estados) — mismo criterio ya aplicado en el ticket 029 (git rm explícito, no solo dejar de usar).
- Actualiza `docs/ARQUITECTURA.md` documentando explícitamente este cambio de comportamiento (regla 9 de CLAUDE.md: "cambios que rompen compatibilidad... requieren señalarlo explícitamente") — aunque ya fue confirmado por Marco en la fase de definición, se documenta en el repo como referencia futura.

## Qué NO hacer
- No retirar nada de esto ANTES de que el flujo nuevo (037-044) esté completo y verificado en vivo — este ticket va al final a propósito, para no dejar a la app sin forma de editar una textura en algún punto intermedio.

## Verificación
- En vivo (Claude in Chrome): confirmar que ya no existe ninguna forma de llegar al editor sin pasar por un proyecto (crear uno nuevo o abrir uno existente); revisión de código confirmando que no queda código muerto de la navegación vieja.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que exploro toda la navegación de la app, cuando busco una forma de editar un mob sin pasar por un proyecto, entonces no la encuentro — toda edición requiere un proyecto activo.
- Dado el código fuente, cuando reviso `HomeScreen.tsx` y el `view` viejo de `App.tsx`, entonces no queda código muerto de la navegación anterior sin usar.
