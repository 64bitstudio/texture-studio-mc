# 041 — Vista de detalle de "Proyecto"

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-2, "Diseño técnico" — nuevo estado `activeProject`). Pieza central del flujo nuevo: es el punto de llegada desde "Nuevo proyecto" (038), "Mis proyectos" (039) y "Recientes" (040), y el punto de partida hacia el editor (043) y "Agregar mobs" (042).

## Alcance
- Vista "Proyecto" (destino `'proyecto'`): recibe el proyecto activo (nombre + lista de mobs que ya tiene, con alguna miniatura/indicador visual por mob) y muestra:
  - Lista de mobs del proyecto, cada uno clickeable para entrar a editarlo (navega a `'editor'`, ticket 043, con ese mob activo).
  - Acción "Agregar mobs" (navega a `'agregar-mobs'`, ticket 042).
  - Acción "Exportar proyecto (.zip)" (ticket 044 — este ticket puede dejarla deshabilitada/placeholder si 044 no está listo aún, o implementarse en el mismo PR si se hace en orden).
  - Acciones "Renombrar" y "Eliminar" proyecto — reusan la lógica ya existente de `projectStorage.ts` (renombrar puede requerir una función nueva si no existe; eliminar ya existe, `deleteProject`), con confirmación inline para eliminar (mismo patrón ya usado, ticket 019).
- Nuevo estado `activeProject: {name: string, mobIds: string[]} | null` en `App.tsx`, poblado al entrar a esta vista (desde crear/abrir un proyecto) — es la fuente de verdad que el ticket 043 usa para restringir el selector de mob del editor.

## Qué NO hacer
- No implementar la exportación en sí en este ticket si el 044 no está listo — puede quedar como acción deshabilitada temporalmente, documentado explícitamente (no silencioso).

## Verificación
- En vivo (Claude in Chrome): abrir un proyecto con varios mobs, confirmar que se listan todos; elegir uno y confirmar que entra al editor de ese mob; renombrar y eliminar con la confirmación inline correspondiente.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado un proyecto abierto, cuando veo su vista de detalle, entonces veo la lista de mobs que ya tiene y las acciones disponibles (agregar mobs, exportar todo, renombrar, eliminar).
- Dado que elijo uno de los mobs listados, cuando confirmo, entonces entro al editor de ese mob.
- Dado que elijo "Eliminar proyecto", cuando confirmo en el aviso inline, entonces el proyecto desaparece de "Mis proyectos"/"Recientes"; si cancelo, no se borra nada.
