# 095 — Asistencia de IA para color con variación (degradado y moteado), no solo color plano

## Objetivo

Nace de `docs/definiciones/textura-con-detalle-visual-ia.md` (HU-1, "Camino A" -- con VoBo de Marco). El asistente de color de IA (ticket 089) hoy propone un solo color hex plano por cara, lo cual Marco encontró "muy básico" al compararlo con una referencia real (textura con grietas/degradados/sensación de corrosión y desgaste). Se investigó la vía de generación de imagen por IA alineada al atlas UV real y se descartó por inviabilidad técnica confirmada (ver el documento de definición) -- este ticket es la alternativa elegida: extender el asistente de color EXISTENTE para que produzca variación (degradado direccional y/o moteado) calculada 100% localmente en el navegador, sin ninguna llamada de red adicional, sin costo, sin cambiar el modelo de IA de texto ya usado (`gemini-3.6-flash`, `responseMimeType: application/json`).

Decisiones ya confirmadas con Marco (no reabrir):
- **Tipo de variación**: "ambos disponibles" -- la IA elige, por cara, si aplica degradado direccional, moteado, o ninguno (mismo criterio que hoy: una propuesta puede omitir partes/caras completas).
- **Intensidad**: controlable desde la UI (no fija) -- un control (slider) antes de generar/aplicar la propuesta.
- Alcance ADITIVO: no reemplaza ni cambia el comportamiento de "Automático"/"Puente manual" como formas de pedir la propuesta -- lo que cambia es el CONTENIDO de la propuesta (`ColorProposal`) y cómo se rasteriza.

## Criterios de aceptación (TDD)

**Contrato de datos (`colorProposal.ts`)**
- `ProposedPartColors` se extiende para que cada cara acepte, además del color plano actual (retrocompatible -- una propuesta con solo `"front": "#RRGGBB"` sigue siendo válida y se sigue pintando como color sólido, sin variación), una variante con variación: `{ type: "gradient" | "speckle", baseColor: "#RRGGBB", accentColor: "#RRGGBB", direction?: ... }` para gradiente, o `{ type: "speckle", baseColor, accentColor, density? }` para moteado (el detalle exacto de los campos queda a criterio de implementación, pero debe ser JSON simple, sin binarios).
- `validateAndApplyColorProposal` rechaza una forma inválida de variación (mismo criterio que ya usa para el resto del esquema: mensaje de error legible, nunca falla en silencio) y sigue rechazando una parte/cara que no existe en la geometría.

**Prompt (`buildColorProposalPrompt`)**
- El prompt le explica a la IA las 3 opciones por cara (color plano / degradado / moteado) y cuándo usar cada una (ej. moteado para corrosión/desgaste, degradado para sombreado/volumen), preservando el contexto geométrico ya agregado (size/position/hijaDe para cajas custom -- hallazgo real anterior, no se pierde).
- Un test verifica que el prompt sigue conteniendo ese contexto geométrico Y ahora también explica las opciones de variación.

**Rasterizado**
- Una cara con `type: "gradient"` pinta un degradado real entre `baseColor` y `accentColor` sobre exactamente los pixeles de esa cara (reusando `computeBoxFaceRects` como fuente de verdad, sin salirse de los límites de la cara ni traslapar otras).
- Una cara con `type: "speckle"` pinta una mezcla pseudo-aleatoria (pero determinista dado un seed, para que los tests sean reproducibles) de `baseColor`/`accentColor` sobre los pixeles de esa cara, sin salirse de sus límites.
- Una cara con color plano (formato actual, sin `type`) sigue pintándose exactamente igual que hoy -- test de regresión explícito confirmando que el comportamiento anterior no cambió.
- El factor `scale` (resolución de trabajo >x1) sigue aplicando correctamente a la variación, igual que ya aplica al color plano hoy.

**UI (control de intensidad)**
- El panel "Asistencia de IA" del editor de textura tiene un control (slider) de intensidad de la variación, visible antes de generar/validar una propuesta, en ambos modos (Automático y Puente manual).
- La intensidad elegida se usa al RASTERIZAR la propuesta ya aplicada (afecta cuánto se separan `baseColor`/`accentColor`, o la densidad del moteado) -- no hace falta que afecte el prompt que ve la IA (la IA sigue proponiendo `baseColor`/`accentColor`; la intensidad es un parámetro de post-procesamiento local).
- Confirmación explícita antes de aplicar se mantiene igual que hoy (vista previa + "Aplicar sobre el atlas"/"Descartar") -- no se relaja ese criterio de HU-8 del ticket 089.

**Regresión**
- Suite completa de `colorProposal.spec.ts` (existente + nuevos casos) en verde.
- Ningún cambio de comportamiento visible para una propuesta que solo usa colores planos (retrocompatibilidad real, no solo de tipos).

## Hecho
