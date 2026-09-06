# 015 — BUG CRÍTICO: el pack exportado se ve mal en Minecraft real (overlay "hat" del casco contaminado)

## Objetivo
Reportado por Marco: exportó un pack real, lo probó en un cliente Minecraft real (screenshot adjunto), y la cabeza del esqueleto se ve como una caja lisa gris/tostada sin cara — mientras que torso/piernas sí muestran el diseño morado correcto. En la app (visor 3D y editor) todo se veía bien, incluida la cara con ojos brillantes.

## Diagnóstico ya hecho por el orquestador (verificado con evidencia real, no solo visual — no repetir desde cero)

**Causa visual confirmada**: el modelo Java/Bedrock del Esqueleto incluye, además de las 6 cajas que este proyecto ya modela (head/body/armRight/armLeft/legRight/legLeft), una **séptima caja "hat"** — un overlay del casco, del mismo tamaño que la cabeza pero ligeramente inflado (`inflate: 0.5`), que se renderiza SIEMPRE encima de la cabeza real. En la textura vanilla real (64×32, formato clásico) esta caja usa la región UV `(32,0)-(64,16)` — la mitad derecha de la franja superior — y está **100% transparente** en el asset vanilla real (por eso nunca se ve en el juego normal: los esqueletos no muestran "sombrero"). Confirmado:
- Fuente oficial: [`Mojang/bedrock-samples/skeleton.geo.json`](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/skeleton.geo.json) — bone "Hat", origin `[-4,24,-4]`, size `[8,8,8]`, uv `[32,0]`, inflate `0.5`.
- Verificado pixel a pixel contra el `skeleton.png` vanilla real: la región `(32,0)-(64,16)` es alpha=0 en el 100% de sus pixeles.
- Verificado en el PNG exportado por Marco (`skeleton.png` del pack): esa misma región está **100% OPACA**, con exactamente los 2 colores (`214,209,197` y `176,170,156`) que usa `backend/src/services/placeholderTexture.ts` (`BASE_COLOR`/`GRID_COLOR`) — es decir, el patrón visual del placeholder terminó "quemado" en esa zona de la textura real exportada. Como esa caja se renderiza inflada sobre la cabeza real, un contenido opaco ahí tapa COMPLETAMENTE la cara real por debajo — exactamente el síntoma reportado.
- **Ya descartado por el orquestador** (reproducido en vivo contra DEV, sin lograr reproducir el problema con esto solo): cargar la app fresca a ×1 dej the a esa región en alpha=0; cambiar de resolución (×1→×4) SIN pintar nada TAMBIÉN la deja en alpha=0 (`resamplePixelSource`/`TextureBuffer` no son la causa por sí solos). El endpoint `/api/base-assets/skeleton` en DEV sigue sirviendo el asset real sin contaminar. La contaminación ocurrió durante la sesión real de edición de Marco (import/pegar/simetría/aislar parte/cambios de resolución en combinación, sesión larga) — el camino exacto que la produce NO quedó identificado, sólo el síntoma final.

## Alcance (dos partes, ambas obligatorias)

### Parte A — Mitigación robusta (hacer esto SIEMPRE, sin importar si se encuentra la causa exacta)
El proyecto ya sabe exactamente qué pixeles pertenecen a las 6 cajas conocidas (`computeUVBoxRects`/`SKELETON_GEOMETRY`). **Cualquier pixel del lienzo que no caiga dentro de esas cajas es, por definición, zona no editable** (incluye el hat overlay `(32,0)-(64,16)` y varios huecos más — en total ~45% del lienzo 64×32 nativo no pertenece a ninguna caja). Antes de exportar (PNG y ZIP, ticket 006), fuerza alpha=0 en TODA esa zona no cubierta, sin importar qué haya en el buffer en ese momento. Esto convierte cualquier fuga futura (conocida o no) en inofensiva para el resultado final en Minecraft real.

### Parte B — Encontrar y corregir la fuga real si es razonablemente alcanzable
Investiga qué combinación de acciones puede escribir pixeles opacos fuera de las cajas conocidas. Candidatos ya evaluados y descartados por el orquestador (no repitas esas pruebas en vano, pero sí verifica tú mismo si tienes dudas): resolución sola, `resamplePixelSource`, `TextureBuffer` constructor default, límites de caja de `computeUVBoxRects` (bounds correctos, no incluyen el hat). Candidatos SIN evaluar todavía, revisa estos primero:
- "Importar textura (PNG 64×32 o NxM)" (ticket 005/009): ¿la validación de dimensiones o la carga (`loadFromImageData`) puede dejar pasar/generar contenido en zonas fuera de las cajas si el PNG importado ya traía algo ahí?
- "Pegar imagen" (ticket 005/013) SIN ninguna parte aislada: el rect inicial cae en `uvBoxes[0]` como fallback — confirma que el "quemado" final (`computeBurnPixels`) recorta estrictamente a los límites de UNA caja aunque el overlay visual se haya arrastrado/redimensionado hacia la zona muerta.
- Cualquier combinación de cambiar de resolución CON contenido ya pintado cerca del borde de una caja, seguido de simetría o pegado — la reescritura de `PixelSource` durante un resize podría interactuar mal con una operación posterior.

Si tras una investigación razonable no se encuentra la fuga exacta, está bien cerrar el ticket solo con la Parte A (la mitigación) — no bloquees el fix robusto esperando encontrar la causa exacta, pero documenta el esfuerzo de investigación y lo que se descartó.

## Qué NO hacer
- No le pidas a Marco que rehaga su diseño — el fix debe preservar/recuperar, en la medida de lo posible, el contenido real que sí pintó (cabeza con calavera y ojos), no descartarlo. La Parte A (forzar transparencia en zona no cubierta) NO borra el diseño real de la cabeza (que vive dentro de la caja `head`, UV `(0,0)-(32,16)`) — solo limpia la zona ajena al hat overlay y otros huecos.

## Verificación esperada
- Exporta el PNG/ZIP tras el fix y confirma con un script (`PIL`/similar) que TODA la zona fuera de las 6 cajas conocidas es alpha=0, para varias resoluciones (×1, ×4, ×10).
- Si es posible, valida en un cliente Minecraft real (o pide a Marco que lo valide) que la cabeza ya muestra el diseño real sin el overlay opaco tapándola.
- Confirma que el contenido real de la cabeza (dentro de su caja UV) no se vio afectado por el fix.
