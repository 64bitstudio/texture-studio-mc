# 014 — BUG: el modelo 3D deja de sincronizarse al trabajar en resolución ×2 o superior

## Objetivo
Reportado por Marco: al pegar una imagen con resolución de trabajo en ×4 (256×128), el cambio se ve en la cuadrícula del editor pero NO se refleja en el modelo 3D.

**Diagnóstico ya hecho por el orquestador antes de crear este ticket (verificado en vivo contra `https://texture-studio-dev.64bitstudio.com/`, con `getImageData` real, no solo visual) — no es un bug de "pegar imagen" específicamente, es más grave:**

- A resolución ×1 (nativa, 64×32): pintar un pixel se refleja correctamente en el modelo 3D. Confirmado.
- A resolución ×4 (256×128): pintar un pixel a mano (sin pegar nada) actualiza correctamente el buffer (confirmado con `getImageData` en el canvas del editor — el pixel rojo aparece exactamente donde se pintó) y la cuadrícula 2D se ve bien. **El modelo 3D no cambia en absoluto** — se queda congelado con el contenido de textura que tenía en el momento de cambiar a ×4, ignorando cualquier edición posterior (pintar, pegar, lo que sea).
- Osea: el bug es "cualquier edición posterior a un cambio de resolución (×2-×10) deja de sincronizarse con el 3D", no algo específico del flujo de pegado del ticket 013.

**Hipótesis técnica a verificar (no asumida como cierta, hay que confirmarla en el código antes de aplicar el fix):** `frontend/src/hooks/useCanvasTexture.ts` crea la `THREE.CanvasTexture` UNA sola vez (`useState`) y, cuando el `buffer` cambia de tamaño (ticket 009), redimensiona el `<canvas>` offscreen y llama `texture.needsUpdate = true` — pero nunca hace `texture.dispose()` ni recrea el objeto `THREE.CanvasTexture`. Es un patrón conocido de three.js: cuando el canvas que respalda una `Texture` ya subida a GPU cambia de tamaño, `needsUpdate = true` no siempre fuerza una reasignación completa de la memoria de textura en GPU (dependiendo de cómo three.js cachea el tamaño previo internamente) — el fix típico es disponer (`dispose()`) y recrear la textura cuando el tamaño del canvas backing cambia, no solo redimensionar y marcar `needsUpdate`.

## Alcance
1. Confirmar la causa raíz real (puede ser la hipótesis de arriba u otra — no asumir, verificar).
2. Corregir `useCanvasTexture.ts` (o donde corresponda tras la investigación) para que la sincronización con el modelo 3D funcione correctamente en CUALQUIER resolución de trabajo (×1 a ×10), no solo la nativa.
3. Agregar un test (unitario si la lógica es aislable, o al menos dejar un caso de verificación en vivo documentado) que cubra específicamente "pintar en una resolución ≠ ×1 se refleja en el 3D" para que esta regresión no vuelva a colarse silenciosamente.

## Qué NO hacer
- No agregues un botón de "forzar refresco" manual como solución — el sync debe ser automático, igual que ya funciona en ×1 desde el ticket 002.
- No reduzcas el alcance de la resolución escalable (ej. "solo hasta ×2") como forma de esquivar el bug — corrige la causa real.

## Verificación esperada
- En vivo (Claude in Chrome) contra la app en local, en AL MENOS 3 resoluciones (×2, ×4, ×10): pintar un pixel/trazo se refleja de inmediato en el modelo 3D, igual que ya sucede en ×1. Repetir la prueba de pegar imagen (ticket 013) en ×4 y confirmar que también se refleja.
- Confirmar que el fix no rompe nada de lo ya construido en ×1 (regresión inversa) ni el cambio de resolución en sí (ticket 009, preservar contenido pintado al cambiar de resolución).

## Hecho
Corregido por el agente `fullstack-dev` (PR [#30](https://github.com/64bitstudio/texture-studio-mc/pull/30)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

**Causa raíz real confirmada** (leyendo `node_modules/three/build/three.module.js`, no solo la hipótesis inicial): three.js solo reserva memoria de GPU (`gl.texStorage2D`, la que fija el tamaño) la primera vez que sube una `Texture`, o cuando cambia su "cache key" — que nunca incluye ancho/alto. Redimensionar el `<canvas>` offscreen y solo marcar `needsUpdate = true` (lo que hacía el hook desde el ticket 009) reutilizaba la asignación GPU vieja (del tamaño nativo) y escribía los pixeles nuevos sobre ella — de ahí el modelo congelado en cualquier resolución ≠ ×1.

**Fix**: `useCanvasTexture.ts` ahora deriva la `THREE.CanvasTexture` con `useMemo` sobre `[canvas, buffer.width, buffer.height]` — mientras el tamaño no cambia, reutiliza la misma instancia (camino barato de siempre); cuando cambia, crea una `Texture` nueva (fuerza a three.js a reservar memoria GPU fresca), disponiendo la vieja automáticamente.

**Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, reproduciendo exactamente el escenario original de Marco): en ×4, subir/confirmar una imagen ahora sí se refleja de inmediato en el modelo 3D (la cabeza del esqueleto se pintó completamente del color de la imagen pegada). El agente además verificó en ×2 y ×10 (pintado a mano), confirmó que ×1 sigue sin regresión, y que el contenido se preserva al cambiar de resolución.

Sin test unitario nuevo — documentado explícitamente por qué (la lógica del fix está acoplada a `WebGLRenderer`, no es extraíble como función pura sin mockear WebGL sin señal real; consistente con la convención ya establecida del proyecto de validar canvas/three.js con revisión visual en vivo).
