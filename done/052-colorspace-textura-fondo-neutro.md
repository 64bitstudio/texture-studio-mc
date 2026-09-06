# 052 — Color space de la textura 3D + fondo neutro del visor

## Objetivo
Séptima pasada de corrección visual sobre el visor 3D (tickets 048-051). Marco mandó 2 imágenes (captura de la app vs. la imagen de referencia) señalando que "tal vez en código son idénticos pero visualmente no lo son ni para el fondo ni para el modelo 3D" -- alcance explícitamente **solo visual**.

## Alcance
- `useCanvasTexture.ts`: `colorSpace = THREE.SRGBColorSpace` explícito en la `CanvasTexture` -- hallazgo real: `THREE.Texture` (clase base) trae `colorSpace = NoColorSpace` por default, así que el renderer no decodifica sRGB→lineal al muestrear la textura aunque sí codifica lineal→sRGB a la salida (`WebGLRenderer` con `outputColorSpace` sRGB por default) -- ese descalce de un solo sentido es la causa real de la apariencia "lavada"/de bajo contraste del modelo (el `toneMapped: false` del ticket 051 no alcanzaba a esto, era un problema distinto y adicional).
- `Viewer3D.tsx`: el fondo verde del ticket 049 se revierte a un dark neutro/azulado (`#0f171d`, el mismo `--bg` que ya usa el resto de la app) -- muestreo directo de la imagen de referencia que mandó Marco confirmó que el fondo NO es verde.

## Qué NO hacer
- Mismo alcance ya establecido en 048-051 -- componentes compartidos (Editor/AgregarMobs/NuevoProyecto se benefician todos).
- No tocar los colores de la cuadrícula del piso (ticket 051, ya remuestreados con precisión y confirmados correctos en este mismo re-muestreo).

## Verificación
- En vivo (Claude in Chrome): comparación directa contra la imagen de referencia -- fondo y saturación/contraste del modelo confirmados en "Nuevo proyecto" Y en el Editor (componente compartido, sin errores de consola).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que veo el visor 3D con un mob cargado, cuando comparo el fondo contra la imagen de referencia, entonces coinciden (dark neutro, no verde).
- Dado que veo el modelo 3D, cuando comparo su saturación/contraste contra la imagen de referencia, entonces coinciden (sin la apariencia "lavada" de antes).

## Hecho

Implementado tal como estaba alcanzado -- ver `docs/ARQUITECTURA.md`, "Ticket 052" para el detalle técnico completo:

- **`useCanvasTexture.ts`**: `colorSpace = THREE.SRGBColorSpace` explícito en `createCanvasTexture()` -- causa real del modelo "lavado" (distinta y adicional al tone mapping ya corregido en el ticket 051): `THREE.Texture` defaultea a `NoColorSpace`, generando un descalce sRGB de un solo sentido en el pipeline de color (decodificación de entrada faltante, codificación de salida sí aplicada).
- **`Viewer3D.tsx`**: fondo revertido a `#0f171d` (mismo `--bg` del resto de la app) -- muestreo de la imagen de referencia que mandó Marco confirmó que no es verde, contradiciendo el pedido del ticket 049.

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): comparación directa contra la imagen de referencia (recorte ampliado) en "Nuevo proyecto" Y en el Editor (mismo hook/componente compartido, sin errores de consola) -- fondo y saturación/contraste del modelo ahora coinciden, mejora sustancial sobre el ticket 051.

Sin hallazgos de QA pendientes.
