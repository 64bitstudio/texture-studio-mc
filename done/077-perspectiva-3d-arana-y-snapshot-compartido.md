# 077 — Perspectiva 3D de la Araña + encuadre de cámara compartido entre visor y miniatura

## Objetivo
Ronda de correcciones de Marco sobre la Araña en el visor 3D y su miniatura de tarjeta: la vista inicial se mostraba de espaldas/con una perspectiva incorrecta (bug real de renderizado, no una preferencia de diseño -- "no asumas que se invirtio como tal, asi siempre debio ser, estabas renderizando mal"), la composición quedaba demasiado inclinada, la miniatura de la tarjeta seguía mostrando la Araña volteada después de corregir el visor (las dos vistas tenían fórmulas de cámara independientes, desincronizadas), y el encuadre final recortaba o dejaba demasiado espacio vacío alrededor del modelo.

## Criterios de aceptación (TDD)
- Dado el visor 3D interactivo con la Araña, cuando se abre, entonces la cabeza queda del lado izquierdo del cuadro y la composición es nivelada (cabeza/abdomen a alturas similares, sin inclinación excesiva).
- Dado un mob con `swapFrontBack` en alguna parte (hoy solo la cabeza de la Araña), cuando se renderiza en 3D, entonces el visor interactivo y la miniatura estática de la tarjeta muestran EXACTAMENTE el mismo ángulo -- no hay dos fórmulas de cámara independientes que puedan desincronizarse.
- Dada la miniatura 3D de cualquier mob (tarjeta/modal ampliado), cuando se genera, entonces el modelo nunca queda recortado (ninguna parte fuera del cuadro) sin importar la forma del cuerpo (cuerpos angostos como el Esqueleto o de patas extendidas como la Araña).
- Dada esa misma miniatura, cuando se genera, entonces el modelo llena la mayoría del cuadro disponible -- no queda un punto pequeño rodeado de espacio vacío.
- Dado que se cambia de mob en "Nuevo proyecto" (tarjetas de selección), cuando se selecciona uno distinto, entonces el visor 3D de la vista previa muestra el ángulo/cámara correcto del mob RECIÉN seleccionado, no la cámara que dejó el mob anterior.

## Hecho
Nueva función pura `computeMobCameraFraming(geometry, cameraZoom)` en `frontend/src/geometry/geometryBounds.ts` (junto con `CAMERA_FOV_DEG` y `computeAllPartCorners`) -- única fuente de verdad del encuadre de cámara, consumida tanto por `Viewer3D.tsx` (visor interactivo) como por `renderMobSnapshot3D.ts` (miniatura estática de tarjeta/modal). Antes de este ticket cada uno tenía su propia fórmula, lo que causaba que la miniatura quedara desactualizada tras corregir el visor.

Elevación: blend del 15% (bajado desde un valor más alto que producía una inclinación excesiva) entre un ángulo de referencia y uno derivado del aspect ratio del cuerpo. `frontSign` (derivado de `swapFrontBack`, ver `spiderGeometry.ts`/`applyBoxUV.ts`) ahora invierte tanto el offset X como el Z de la cámara, para que la cara quede del lado izquierdo del cuadro en vez del derecho.

"Nunca recortar": la distancia mínima de cámara se calcula proyectando los corners de CADA parte individual (`computeAllPartCorners`, no los 8 corners del bounding box completo -- ese bounding box es una cota MUY floja para un cuerpo de patas extendidas como la Araña, sobreestimando el espacio vacío) sobre los ejes reales derecha/arriba de la cámara (verificados contra el comportamiento real de `THREE.PerspectiveCamera.lookAt`), con un margen del 6%. Verificado por medición directa de píxeles no transparentes del PNG renderizado: el llenado del cuadro mejoró de 55%/46% (ancho/alto) a 68%/57%.

`swapFrontBack?: boolean` nuevo en `MobBoxPart` (frontend y backend) + `applyBoxUV.ts` -- intercambia qué cara de la caja 3D (`pz`/`nz`) recibe las regiones UV `front`/`back` (análogo a `mirrorX`), sin afectar el mapa de píxeles 2D ni `faceLabels`. Activado en la cabeza de la Araña (`backend/src/geometry/spiderGeometry.ts`) -- bug de renderizado real, no un cambio de diseño (confirmado explícito por Marco).

`NuevoProyecto.tsx`: `<Viewer3D key={previewMobId}>` -- sin esta key, React-Three-Fiber reutilizaba el mismo `<Canvas>`/cámara al cambiar de mob (la posición de cámara de `<Canvas camera={{position}}>` solo se aplica al montar), mostrando el mob nuevo desde el ángulo que dejó el anterior.

Verificado en vivo con Claude in Chrome (oscuro/claro): perspectiva de la Araña contra las referencias de Marco, miniatura de tarjeta sincronizada con el visor, encuadre sin recortes y con buen llenado para los 4 mobs. `tsc`/`oxlint`/`vitest`/`build` en verde.
