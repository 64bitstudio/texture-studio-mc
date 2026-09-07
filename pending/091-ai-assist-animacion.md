# 091 — Extender AIAssistProvider a animación

## Objetivo
Extender el `AIAssistProvider` a la Etapa 4 en dos niveles de confianza: HU-11 (ajuste de parámetros de un preset -- alta confianza, siempre se construye) y HU-12 (keyframes libres -- experimental, se construye solo si el spike del ticket 081 lo recomienda). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 12; HU-11, HU-12). Depende de los tickets 087, 090, y del resultado documentado del ticket 081.

## Criterios de aceptación (TDD)
- Dado que elijo un preset y describo el estilo deseado, la IA devuelve valores de parámetros (no keyframes libres) dentro de los rangos válidos del preset, aplicados de inmediato para previsualizar (HU-11).
- Dado que los parámetros devueltos están fuera de rango, la app los recorta a los límites válidos antes de aplicarlos, sin error visible (HU-11).
- Dado que ajusto los sliders manualmente después de una propuesta de IA, el comportamiento es idéntico a haber elegido esos valores desde el inicio (HU-11).
- (Solo si el ticket 081 recomendó construir HU-12) Dado que describo una animación libre y recibo una propuesta válida, se carga como keyframes editables en el timeline sin reemplazar animaciones existentes de otro nombre; keyframes con saltos bruscos o cierre de loop incompatible se marcan visualmente sin bloquear la importación; descartar la propuesta deja el timeline como estaba (HU-12).

## Hecho
