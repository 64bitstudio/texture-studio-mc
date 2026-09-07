# 089 — Extender AIAssistProvider a color (Etapa 3)

## Objetivo
Reusar el `AIAssistProvider` ya construido (ticket 088) para proponer una primera pasada de color sobre el atlas de textura ya definido, según una descripción de estilo. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 10; HU-8). Depende de los tickets 086 (editor de textura sobre modelo confirmado) y 088.

## Criterios de aceptación (TDD)
- Dado el editor de textura abierto, cuando elijo "Generar color con IA" (puente manual o automático) y confirmo una propuesta válida, el atlas se rellena, quedando disponible para seguir pintando encima con las herramientas existentes.
- Dado que ya pinté manualmente antes de pedir la propuesta, cuando la aplico, veo una confirmación explícita de que se sobreescribirá lo ya pintado, antes de que ocurra.

## Hecho
