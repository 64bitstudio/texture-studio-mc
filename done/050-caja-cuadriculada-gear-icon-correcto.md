# 050 — Visor 3D como caja cuadriculada + ícono de Configuración correcto

## Objetivo
Quinta pasada de corrección visual sobre el visor 3D y el ícono de Configuración (tickets 046-049). Marco pidió 2 correcciones más -- alcance explícitamente **solo visual**.

Pedido textual de Marco (verbatim, resumido):
1. El ícono de Configuración "ya no se parece" -- adjuntó una imagen de referencia directa (no un mockup completo, el ícono suelto): una flor de 6 pétalos redondeados de TRAZO FINO (no relleno), con un aro chico suelto en el centro.
2. La cuadrícula del visor 3D debe verse "como si fuera el fondo de una caja" -- imaginando al mob dentro de una caja vista desde la perspectiva actual, faltan la pared de la izquierda y la derecha (cuadriculadas igual que el piso). El piso, además, debe ser de un verde más sutil que el de la revisión anterior.

## Alcance
- `ui/icons.tsx`: `IconSettings` reconstruido por tercera vez -- esta vez con la geometría CORRECTA (confirmada contra imagen de referencia real, no una suposición): contorno de 6 pétalos vía curva paramétrica `r(θ) = R_prom + R_amp·cos(6θ)`, trazo fino (no relleno), aro central suelto.
- `Viewer3D.tsx`: 2 planos `<Grid>` adicionales (mismo componente que el piso, rotados 90°) simulando las paredes izquierda/derecha de una "caja" -- mismos colores/tamaño de celda que el piso para que combinen. Colores del piso (y de las paredes nuevas) más sutiles que la revisión del ticket 049.

## Qué NO hacer
- Mismo alcance ya establecido en 046-049 -- `Viewer3D.tsx` es un componente compartido (Editor/AgregarMobs/NuevoProyecto se benefician todos, mismo criterio ya aplicado en tickets previos).

## Verificación
- En vivo (Claude in Chrome): ícono de Configuración comparado de cerca contra la imagen de referencia; efecto de "caja cuadriculada" (piso + 2 paredes) confirmado en "Nuevo proyecto" Y en el Editor (componente compartido).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que veo el ícono de Configuración de cerca, entonces es un contorno de 6 pétalos de trazo fino con un aro chico en el centro (no relleno, no 8 dientes).
- Dado que veo el visor 3D con un mob cargado, cuando observo el entorno, entonces hay un piso Y dos paredes (izquierda/derecha) cuadriculados, dando la sensación de estar dentro de una caja.
- Dado que veo el piso del visor, entonces su verde es más sutil que en la revisión anterior.

## Hecho

Implementado tal como estaba alcanzado -- ver `docs/ARQUITECTURA.md`, "Ticket 050" para el detalle técnico completo:

- **`IconSettings`** (`ui/icons.tsx`): tercera reconstrucción, esta vez verificada contra una imagen de referencia real del ícono (recorte ampliado con Python/PIL) -- contorno de 6 pétalos vía curva paramétrica `r(θ)=R_prom+R_amp·cos(6θ)` (48 puntos), trazo fino, aro central suelto.
- **`Viewer3D.tsx`**: 2 `<Grid>` adicionales rotados 90° (paredes izquierda/derecha), mismos colores que el piso vía constante compartida `BOX_GRID_PROPS`. Colores más sutiles (`#274435`/`#3c6b4f`, antes `#3a6b4d`/`#5b9e77`).
- **Hallazgo real**: las paredes no se veían inicialmente (ni orbitando la cámara) -- `<Grid>` de drei usa `side: THREE.BackSide` por defecto, correcto para un piso visto desde arriba pero culleando la cara visible de una pared rotada 90°. Fix: `side: THREE.DoubleSide`.

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): ícono de Configuración confirmado con recorte ampliado, coincide con la referencia. Efecto de "caja" (piso + 2 paredes) confirmado en "Nuevo proyecto" Y en el Editor (componente compartido, sin errores de consola).

Sin hallazgos de QA pendientes.
