# 084 — Jerarquía padre-hijo entre cajas (huesos)

## Objetivo
Permitir declarar una caja como "hija" de otra dentro del editor de modelo, con una jerarquía por defecto ya cargada para los 4 mobs vainilla, y sin permitir ciclos. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 5; HU-3; "Diseño técnico"). Depende del ticket 083.

## Criterios de aceptación (TDD)
- Dado el editor de modelo abierto, cuando asigno una caja como hija de otra, el visor 3D refleja la relación (mover/rotar el padre arrastra visualmente a la hija en la previsualización).
- Dado un modelo recién creado a partir de un mob vainilla, cuando lo abro, ya trae la jerarquía por defecto sin acción del usuario: Esqueleto/Zombie con `body` raíz y `head`/`armRight`/`armLeft`/`legRight`/`legLeft` como hijas; Araña con `thorax` raíz y `head`/`abdomen`/las 8 patas como hijas; Creeper con `body` raíz y `head`/las 4 patas como hijas.
- Dado que intento asignar una caja como hija de sí misma o de uno de sus propios descendientes, la app lo rechaza con un mensaje claro.

## Hecho
