# Ticket 080 — assets del spike

## `test-model.bbmodel`

Modelo de prueba mínimo, hecho a mano (por Claude, siguiendo la especificación de formato investigada -- **no generado con Blockbench real**), para validar el pipeline completo contra FreeMinecraftModels antes de construir el editor propio:

- 3 cajas: `body` (raíz), `head` (hija de `body`), `armRight` (hija de `body`) -- jerarquía padre-hijo real, para probar que rotar el padre arrastra a las hijas.
- Textura embebida: un PNG sólido 64x64 gris-verdoso (placeholder, no arte real -- lo único que importa para el spike es que se aplique en el lugar correcto).
- Dos animaciones con los nombres exactos que FreeMinecraftModels reconoce automáticamente: `idle` (vaivén sutil del brazo, loop de 2s) y `walk` (swing más amplio y rápido del brazo, loop de 0.7s) -- para poder distinguir a simple vista si el plugin transiciona entre ellas según la velocidad del mob, como documenta su wiki.

### Antes de llevarlo al servidor: ábrelo en Blockbench

El formato `.bbmodel` no tiene una especificación pública completa (ver `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md`, "Riesgos") -- este archivo está armado a mano siguiendo la mejor evidencia encontrada (gist de la comunidad + comportamiento documentado), pero **no está garantizado que Blockbench lo abra sin quejarse**. Primer paso real del spike: abrirlo en Blockbench (gratis, web o desktop) y confirmar que:
1. Carga sin errores.
2. Se ve como 3 cajas con la textura aplicada.
3. La jerarquía (`body` > `head`, `armRight`) aparece correcta en el outliner.
4. Las animaciones `idle`/`walk` reproducen el swing del brazo como se espera.

Si algo de esto falla, corregir el archivo directamente en Blockbench (o pedirle a Claude que ajuste el JSON) antes de pasar al servidor -- no tiene caso probar contra FreeMinecraftModels un archivo que ni siquiera Blockbench reconoce.

### Siguiente paso: servidor de prueba

Ver `in-process/080-spike-validar-freeminecraftmodels-real.md` para los criterios de aceptación completos (servidor Paper/Spigot 1.21.4+ + Java 21 + plugin FreeMinecraftModels instalado, spawnear el modelo, verificar geometría/textura/jerarquía/animaciones contra el juego real).
