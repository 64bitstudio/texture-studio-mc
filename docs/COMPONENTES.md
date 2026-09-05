# Componentes — Texture Studio MC

Estructura de pantalla prevista (se ajusta conforme avanza el desarrollo real):

- **`Viewer3D`** — visor 3D del modelo (Three.js / `@react-three/fiber`): geometría por cajas del Esqueleto, controles de cámara orbit/zoom/pan, material con la textura editable.
- **`TextureEditor`** — cuadrícula 64×32 (`<canvas>` 2D) donde se pinta pixel a pixel; zoom/grid ajustable; modo brocha (drag).
- **`ColorPicker`** — selector de color libre (hex/RGB) + paleta predefinida "estilo Minecraft".
- **`ToolsPanel`** — undo/redo, toggle de simetría (+ eje), importar textura existente, pegar/ajustar imagen a una región UV.
- **`ExportBar`** — botones "Exportar PNG" y "Exportar pack (.zip)".
- **`TextureBuffer`** (no visual, estado compartido) — `ImageData` de 64×32, única interfaz de escritura para pincel/importar/pegar/futura IA (ver definición, HU-12).

Se completa/ajusta este archivo conforme se implemente el ticket real del frontend.
