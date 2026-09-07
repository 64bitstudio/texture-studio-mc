# 093 — Exportar .bbmodel: incluir animaciones

## Objetivo
Extender el export del ticket 092 para incluir el array `animations` del `.bbmodel`, con las animaciones nombradas creadas en la Etapa 4 -- cierra el flujo completo de punta a punta del epic. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 14; HU-13, completo). Depende de los tickets 090, 092, y usa el entorno de prueba ya validado en el ticket 080.

## Criterios de aceptación (TDD)
- Dado un mob con al menos una animación, cuando exporto, el `.bbmodel` descargado incluye un array `animations` que refleja correctamente esas animaciones nombradas (nombre + keyframes por hueso).
- Dado ese archivo, cuando se carga en el mismo entorno de prueba de FreeMinecraftModels validado en el ticket 080, las animaciones se reproducen correctamente en el juego (incluyendo el comportamiento automático de `idle`/`walk`/`attack`/`death` si están presentes).

## Hecho
