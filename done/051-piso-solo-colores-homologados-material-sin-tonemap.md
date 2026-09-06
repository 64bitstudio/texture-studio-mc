# 051 — Visor 3D: solo piso (sin paredes), colores homologados, material sin tone mapping

## Objetivo
Sexta pasada de corrección visual sobre el visor 3D (tickets 048-050). Marco pidió revertir las paredes agregadas en el ticket 050, homologar los colores de la cuadrícula con la imagen de referencia (mandó una captura señalando que no coinciden) y corregir que el modelo 3D "siempre se ve como brilloso, no se respetan los colores reales" -- alcance explícitamente **solo visual**.

## Alcance
- `Viewer3D.tsx`: se retiran las 2 paredes del ticket 050 -- vuelve a ser solo el plano del piso.
- Colores de la cuadrícula del piso RE-MUESTREADOS de la imagen de referencia (Python/PIL, no a ojo) -- mucho más sutiles que la revisión del ticket 050.
- `MeshBasicMaterial` del modelo gana `toneMapped: false` -- hallazgo real: `<Canvas>` de react-three-fiber aplica `ACESFilmicToneMapping` por default a TODO el renderer, lo que reinterpreta/altera los colores de la textura en vez de reproducirlos tal cual (causa real de "se ve brilloso, no respeta los colores reales").

## Qué NO hacer
- Mismo alcance ya establecido en 048-050 -- `Viewer3D.tsx` es un componente compartido (Editor/AgregarMobs/NuevoProyecto se benefician todos).
- No tocar el fondo verde de la escena (ticket 049, ya confirmado por Marco) -- este ticket es específicamente sobre la cuadrícula y el material del modelo.

## Verificación
- En vivo (Claude in Chrome): cuadrícula solo-piso con colores más sutiles confirmada en "Nuevo proyecto" Y en el Editor (componente compartido). Verificación de color real: se pintó un color conocido (rojo de la paleta) sobre la textura y se comparó visualmente contra su reproducción en el visor 3D -- coincide (antes del fix se hubiera visto más claro/desaturado por el tone mapping).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que veo el visor 3D con un mob cargado, cuando observo el entorno, entonces solo hay un piso cuadriculado (sin paredes).
- Dado que comparo los colores de la cuadrícula contra la imagen de referencia, entonces coinciden (sutiles, no saturados).
- Dado que pinto un color conocido en la textura, cuando lo veo en el visor 3D, entonces se ve igual (sin el brillo/desaturación que tenía antes).

## Hecho

Implementado tal como estaba alcanzado -- ver `docs/ARQUITECTURA.md`, "Ticket 051" para el detalle técnico completo:

- **`Viewer3D.tsx`**: paredes del ticket 050 retiradas -- vuelve a un único `<Grid>` (piso). `BOX_GRID_PROPS` renombrado a `FLOOR_GRID_PROPS`, sin `side: THREE.DoubleSide` (ya no hace falta sin paredes rotadas).
- **Colores re-muestreados** de la imagen de referencia (Python/PIL): `cellColor: '#20392c'`, `sectionColor: '#2c4d3c'` (antes `#274435`/`#3c6b4f`) -- mucho más cerca del fondo de la escena, coincide con lo sutil que se ve en la referencia.
- **`toneMapped: false`** en el `MeshBasicMaterial` del modelo -- causa real encontrada: `<Canvas>` de react-three-fiber aplica `ACESFilmicToneMapping` por defecto a todo el renderer, alterando los colores reales de la textura (explica exactamente el reporte "se ve brilloso, no respeta los colores reales").

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): cuadrícula solo-piso con colores sutiles confirmada en "Nuevo proyecto" Y en el Editor (componente compartido, sin errores de consola). Verificación de color real: se pintó el rojo de la paleta (`rgb(161,28,17)`, confirmado con `getImageData` sobre el `TextureBuffer`) sobre la textura y se comparó visualmente contra su reproducción en el visor 3D -- coincide (recorte ampliado). No fue posible leer el píxel exacto del canvas WebGL vía `drawImage` (el renderer no tiene `preserveDrawingBuffer` activado, comportamiento esperado de Three.js) -- se optó por verificación visual directa en vez de tocar esa configuración solo para esta prueba puntual.

Sin hallazgos de QA pendientes.
