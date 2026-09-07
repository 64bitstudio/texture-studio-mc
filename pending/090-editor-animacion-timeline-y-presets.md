# 090 — Editor de animación: timeline de keyframes y presets paramétricos

## Objetivo
Construir el editor de animación (Etapa 4): timeline libre de keyframes (agregar/mover/eliminar, reproducir/pausar/scrub) que respeta la jerarquía de huesos, más presets paramétricos para los 5 nombres que FreeMinecraftModels reconoce automáticamente (`spawn`/`idle`/`walk`/`attack`/`death`). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 11; HU-9, HU-10). Depende de los tickets 084 (jerarquía) y 086 (confirmar modelo).

## Criterios de aceptación (TDD)
- Dado el editor de animación abierto, cuando elijo un preset y ajusto sus parámetros (velocidad, amplitud), se genera un set de keyframes reproducible de inmediato en el visor 3D, guardado con ese nombre exacto (HU-9).
- Dado un modelo cuya jerarquía no coincide con lo que un preset espera, cuando intento aplicarlo, veo un aviso claro de qué huesos faltan, sin romper el modelo (HU-9).
- Dado que creo una animación `walk` sin una `idle` en el mismo mob, veo una advertencia explícita (restricción documentada del plugin), sin bloquear la creación (HU-9).
- Dado un nombre fuera de los 5 reconocidos, la app lo guarda igual, indicando que solo será disparable manualmente por código del servidor (HU-9).
- Dado que agrego un keyframe en un momento específico para un hueso, aparece en el timeline y el visor 3D interpola entre keyframes al reproducir (HU-10).
- Dado que reproduzco la animación, un hueso padre con rotación animada mueve visualmente a sus huesos hijos en el preview (HU-10).

## Hecho
