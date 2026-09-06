# 010 — Panel lateral redimensionable con pixeles siempre cuadrados

## Objetivo
Reemplaza al ticket 008 (retirado, ver nota abajo). Sale de feedback directo de Marco: quiere poder ajustar el tamaño del panel lateral (sidebar) donde vive el editor de textura, y la cuadrícula de pixeles **debe mostrarse siempre cuadrada, sin importar cómo se redimensione el panel** — hoy, al cambiar el ancho disponible, el canvas se deforma (pixeles alargados, sin proporción 1:1).

## Nota sobre el ticket 008
El ticket 008 original (`docs/definiciones`... no, ver `done/`... en realidad quedó en `pending/008-corregir-distorsion-canvas-editor.md`) planteaba 3 opciones fijas (ensanchar el sidebar, bajar el zoom default, o `aspect-ratio` real) para que Marco eligiera una. Marco pidió algo mejor: que el tamaño sea ajustable por el usuario Y que los pixeles se mantengan cuadrados en cualquier tamaño — este ticket lo reemplaza. **Cierra el 008 con una referencia a este ticket, no lo implementes tal cual.**

## Alcance

### 1. Panel redimensionable
- Agrega un "handle" (borde arrastrable) entre el visor 3D y el panel lateral (`<aside>`) para que el usuario ajuste su ancho arrastrando con el mouse.
- Persistir el ancho elegido en `localStorage` (conveniencia por navegador, no es un dato del usuario que deba sincronizarse — ver reglas de capacidades de Artifacts, no aplica aquí por ser una app propia, pero el criterio de "conveniencia de sesión" es el mismo).
- Límites razonables de ancho mínimo/máximo (que no desaparezcan los controles ni el panel se coma toda la pantalla) — tú decides los valores, documenta el criterio.

### 2. Pixeles SIEMPRE cuadrados, sea cual sea el ancho del panel
Este es el criterio de aceptación central, no un detalle menor:
- El `<canvas>` del editor de textura NUNCA debe usar `max-width: 100%`/`width: 100%` combinado con una altura que no mantenga la proporción exacta `textureWidth : textureHeight` multiplicada por el zoom activo (ticket 004/009).
- Mecanismo correcto: mide el ancho REAL disponible del contenedor (vía `ResizeObserver`, mismo patrón ya usado por el overlay de pegar imagen del ticket 005) y calcula un factor de escala efectivo a partir de ese ancho — nunca dejes que el navegador estire el canvas de forma independiente en X e Y.
- Si el contenido (textura × zoom) es más ancho que el espacio disponible tras el redimensionamiento, el contenedor debe scrollear horizontalmente (`overflow-x: auto`) en vez de comprimir/deformar los pixeles — un pixel deformado nunca es una opción válida, sea cual sea el ancho elegido.
- Esto debe seguir funcionando correctamente junto con el selector de resolución x1-x10 del ticket 009 (más resolución = más pixeles totales, el mecanismo de escalado debe seguir garantizando cuadrados perfectos).

## Qué NO construir (fuera de este ticket)
- No rediseñes el resto del layout de la app — solo el panel lateral y el editor de textura dentro de él.

## Criterios de aceptación
- Dado cualquier ancho de panel (dentro de los límites min/max), cuando se mide el tamaño renderizado de un texel individual en pantalla, entonces su ancho y alto son iguales (margen de redondeo de 1px).
- Dado que el usuario arrastra el handle para cambiar el ancho del panel, cuando termina de arrastrar, entonces los pixeles de la cuadrícula siguen viéndose cuadrados (no alargados) en todo momento durante y después del arrastre.
- Dado un ancho de panel muy angosto donde el editor completo no cabe a un zoom dado, cuando esto ocurre, entonces aparece scroll horizontal en vez de deformación.
