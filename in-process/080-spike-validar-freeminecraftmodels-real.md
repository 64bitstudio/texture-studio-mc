# 080 — Spike: validar FreeMinecraftModels real con un .bbmodel hecho a mano

## Objetivo
Validar contra la realidad (no solo contra documentación) que un `.bbmodel` con geometría, jerarquía de huesos, textura y animaciones `idle`/`walk` funciona como se espera en el plugin de servidor **FreeMinecraftModels**, ANTES de construir el pipeline de modelado/animación de `texture-studio-mc`. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 1, sección "Riesgos y preguntas abiertas").

## Criterios de aceptación (TDD)
- Existe un servidor Paper/Spigot 1.21.4+ con Java 21 corriendo (local, de prueba), con el plugin FreeMinecraftModels instalado.
- Se crea A MANO en Blockbench (no con `texture-studio-mc`, que todavía no tiene esta capacidad) un `.bbmodel` de 2-3 cajas con jerarquía padre-hijo, una textura simple, y animaciones `idle`+`walk`.
- Ese `.bbmodel` se carga y se spawnea en el servidor de prueba.
- Queda documentado (en este ticket al cerrarlo) si: la geometría/textura se ven correctamente, `idle` hace loop en reposo, `walk` se dispara al moverse, y rotar el hueso padre arrastra visualmente a su hijo en el juego real.
- Cualquier discrepancia contra lo asumido en el documento de definición queda registrada explícitamente y, si aplica, dispara una actualización de ese documento ANTES de continuar con los demás tickets de este epic.

## Hecho
