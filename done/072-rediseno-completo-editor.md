# 072 — Rediseño completo del Editor

## Objetivo
Rediseñar la pantalla del Editor de textura para que coincida con la imagen de referencia de Marco (sidebar completo, breadcrumb, título con acciones, barra de herramientas, selector de color rico, panel de visor 3D + información), EXCEPTO la cuadrícula de edición de la textura en sí (instrucción explícita de Marco: "la parte de la textura en si... mantenlo como lo tenemos nosotros").

## Criterios de aceptación (TDD)
- Dado que se abre un mob desde un proyecto, cuando se muestra el Editor, entonces aparece dentro del mismo `AppShell` que el resto de la app (sidebar completo con "Proyecto actual"/"Mobs del proyecto"/"Agregar mob"), no en un layout dedicado sin sidebar (revierte la decisión del ticket 037).
- Dado el editor abierto, cuando se mira la fila superior, entonces se ve el breadcrumb ("Mis proyectos › Proyecto › Mob") con "Guardar"/"Exportar PNG" a esa misma altura, y debajo el título con el nombre real del mob (sin apodo propio) + badge "Minecraft Java Edition".
- Dado el editor abierto, cuando se mira la barra de herramientas, entonces aparecen Pincel/Borrador (con tamaño de pincel solo visible en modo Borrador)/Deshacer/Rehacer/Resolución/Simetría/Cuadrícula/Zoom, reusando exactamente la lógica ya existente de cada uno.
- Dado que se hace click en "Guardar", cuando el guardado termina con éxito, entonces el buffer actual del mob queda persistido en el proyecto (mismo mecanismo que `AgregarMobModal`, ticket 071).
- Dado el panel de "Vista previa 3D", cuando se hace click en "Restablecer"/pantalla completa, entonces la cámara vuelve a su posición inicial / el visor entra en pantalla completa, ambos funcionales de verdad (no decorativos).
- Dado el selector de color, cuando se elige un color por cualquier medio (paleta, cuadro de saturación, matiz, hex), entonces "Color actual" y el campo hex quedan sincronizados, y el color pasa a "Colores recientes".
- Dado el canvas de edición de la textura (cuadrícula de píxeles) y su lógica de pintado/región/aislamiento, cuando se compara contra el editor anterior, entonces no cambió.

## Hecho
Reestructurado `App.tsx` (el Editor comparte `AppShell` en vez de su layout dedicado sin sidebar) y reescrito `Editor.tsx` completo (breadcrumb/título/toolbar/selector de color/panel derecho), preservando el 100% de la lógica de estado/handlers existente (pintar, deshacer/rehacer, simetría, aislar parte, resolución, importar/pegar imagen). Nuevos: `EditorProjectSidebar.tsx` (contenido del sidebar cuando el editor está activo), `HsvColorPicker.tsx` (reemplaza a `ColorPicker.tsx`), `colorConversion.ts` (hex/rgb/hsv puro).

Confirmado con Marco vía `AskUserQuestion` (dos veces) antes de implementar, por cruzar a terreno de epic grande (regla 6 de CLAUDE.md): sin apodo de mob propio (el editor muestra el nombre real, no una "skin" nombrada distinta), y sí sidebar completo en el editor.

Iteraciones en vivo tras la primera entrega (todas con VoBo pendiente hasta el final, ver 073): el slot "Tamaño" de la barra de herramientas pasó a ser "Resolución" (el tamaño de pincel del borrador se reubicó junto al botón "Borrador", solo visible en ese modo); "Guardar"/"Exportar PNG" subieron a la altura del breadcrumb (antes en la fila de título); "Exportar PNG" pasó a `variant="primary"` + ícono (`IconExport`).

Decisiones disclosed a Marco al presentar: se omiten "Selector"/"Copiar"/"Recortar" de la barra de herramientas de la imagen de referencia (sin equivalente funcional real hoy en la app, regla 8 de CLAUDE.md); "Rotar/Zoom/Mover" del visor 3D son texto informativo, no botones (son gestos del mouse que `OrbitControls` ya maneja, no una acción discreta); se agregó un panel "Archivo" (Importar/Pegar) no presente en la imagen de referencia, para no perder esa funcionalidad existente en silencio.

Bug real encontrado y corregido: el campo de hex de `HsvColorPicker` no se resincronizaba cuando el color cambiaba por otro medio (paleta/cuadro de saturación/matiz) -- corregido con el patrón oficial de React "ajustar estado durante el render" (no un `useEffect`, evita el warning de reflow/cascada del linter).

Verificado en vivo repetidamente con Claude in Chrome (oscuro/claro): pintar/deshacer/rehacer, cambiar de mob por el sidebar (remonta el editor completo), guardar y confirmar persistencia, exportar, cambiar resolución, abrir "Agregar mob" desde el sidebar del editor, Restablecer/pantalla completa del visor. `tsc`/`oxlint`/`vitest` (215)/`build` en verde en cada iteración.

Nota: este ticket y el 071/073 se implementaron en la misma sesión de iteración en vivo con Marco, con cambios entrelazados en algunos archivos compartidos -- van en un único PR (decisión explícita de Marco al dar el VoBo final, ver 073).
