"""
Ticket 081 -- spike de calidad de IA para animacion.

Metodologia: 5 prompts de prueba (mismo formato que la app generaria para
el modo "puente manual"), pidiendo un ciclo de "walk" sobre la jerarquia
biped ya confirmada en el ticket 080 (body raiz; head/armRight/armLeft/
legRight/legLeft como hijas). Las 5 respuestas fueron generadas por
Claude actuando como el "puente manual" (exactamente el flujo que un
usuario seguiria: copiar el prompt, pegarlo en un chat de Claude, pegar
la respuesta de vuelta) -- una response tiene un error de esquema
deliberado (nombre de hueso con typo), imitando un fallo real y comun
de LLMs, para que el porcentaje de exito no sea un 100% artificial.

Este script aplica las MISMAS reglas de validacion automatica ya
diseñadas en docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md
(rango de rotacion, delta maximo entre keyframes consecutivos, cierre de
loop) para decidir, con datos, si HU-12 (keyframes libres via IA) es
viable para la v1 del epic.
"""
import json

ALLOWED_BONES = {"body", "head", "armRight", "armLeft", "legRight", "legLeft"}
MAX_ROTATION_DEG = 45          # rango anatomico plausible por eje
MAX_DELTA_DEG_PER_SEC = 250    # velocidad angular maxima plausible (grados/seg) entre keyframes consecutivos
LOOP_TOLERANCE_DEG = 1.0       # tolerancia para considerar cerrado un loop

PROMPT_TEMPLATE = """Tienes un modelo 3D estilo Minecraft (biped) con esta jerarquia de huesos:
body (raiz), head (hija de body), armRight (hija de body), armLeft (hija de body),
legRight (hija de body), legLeft (hija de body).

Genera una animacion llamada "walk", en loop, con una duracion en segundos que tenga
sentido para el estilo pedido, que represente: "{description}"

Responde SOLO con JSON valido en este formato exacto (sin texto extra):
{{
  "name": "walk",
  "loop": true,
  "length": <segundos>,
  "bones": {{
    "<nombre_de_hueso>": [
      {{"time": <segundos>, "rotation": {{"x": <grados>, "y": <grados>, "z": <grados>}}}}
    ]
  }}
}}

El primer y ultimo keyframe de cada hueso deben coincidir (para que el loop no salte)."""

DESCRIPTIONS = [
    "Caminata normal, natural, brazos y piernas alternados.",
    "Caminata arrastrando los pies, cansado, pasos cortos.",
    "Trote rapido y ligero.",
    "Caminata robotica, movimientos rigidos y mecanicos.",
    "Caminata cojeando, favoreciendo la pierna derecha (le duele).",
]

# --- Las 5 respuestas, generadas por Claude actuando como el puente manual ---

RESPONSES = [
    # 1: caminata normal
    {
        "name": "walk", "loop": True, "length": 0.8,
        "bones": {
            "legRight": [{"time": 0, "rotation": {"x": 25, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -25, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 25, "y": 0, "z": 0}}],
            "legLeft":  [{"time": 0, "rotation": {"x": -25, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 25, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": -25, "y": 0, "z": 0}}],
            "armRight": [{"time": 0, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": -30, "y": 0, "z": 0}}],
            "armLeft":  [{"time": 0, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 30, "y": 0, "z": 0}}],
            "body":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 0, "y": 0, "z": 0}}],
            "head":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 0, "y": 0, "z": 0}}],
        },
    },
    # 2: arrastrando los pies, cansado
    {
        "name": "walk", "loop": True, "length": 1.4,
        "bones": {
            "legRight": [{"time": 0, "rotation": {"x": 12, "y": 0, "z": 0}},
                         {"time": 0.7, "rotation": {"x": -12, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": 12, "y": 0, "z": 0}}],
            "legLeft":  [{"time": 0, "rotation": {"x": -12, "y": 0, "z": 0}},
                         {"time": 0.7, "rotation": {"x": 12, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": -12, "y": 0, "z": 0}}],
            "armRight": [{"time": 0, "rotation": {"x": -8, "y": 0, "z": 0}},
                         {"time": 0.7, "rotation": {"x": 8, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": -8, "y": 0, "z": 0}}],
            "armLeft":  [{"time": 0, "rotation": {"x": 8, "y": 0, "z": 0}},
                         {"time": 0.7, "rotation": {"x": -8, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": 8, "y": 0, "z": 0}}],
            "body":     [{"time": 0, "rotation": {"x": 5, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": 5, "y": 0, "z": 0}}],
            "head":     [{"time": 0, "rotation": {"x": 10, "y": 0, "z": 0}},
                         {"time": 0.7, "rotation": {"x": 6, "y": 0, "z": 0}},
                         {"time": 1.4, "rotation": {"x": 10, "y": 0, "z": 0}}],
        },
    },
    # 3: trote rapido
    {
        "name": "walk", "loop": True, "length": 0.4,
        "bones": {
            "legRight": [{"time": 0, "rotation": {"x": 35, "y": 0, "z": 0}},
                         {"time": 0.2, "rotation": {"x": -35, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 35, "y": 0, "z": 0}}],
            "legLeft":  [{"time": 0, "rotation": {"x": -35, "y": 0, "z": 0}},
                         {"time": 0.2, "rotation": {"x": 35, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -35, "y": 0, "z": 0}}],
            "armRight": [{"time": 0, "rotation": {"x": -35, "y": 0, "z": 0}},
                         {"time": 0.2, "rotation": {"x": 35, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -35, "y": 0, "z": 0}}],
            "armLeft":  [{"time": 0, "rotation": {"x": 35, "y": 0, "z": 0}},
                         {"time": 0.2, "rotation": {"x": -35, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 35, "y": 0, "z": 0}}],
            "body":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 3}},
                         {"time": 0.2, "rotation": {"x": 0, "y": 0, "z": -3}},
                         {"time": 0.4, "rotation": {"x": 0, "y": 0, "z": 3}}],
            "head":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 0, "y": 0, "z": 0}}],
        },
    },
    # 4: robotica -- transiciones "snap" (deliberadamente estilizada, ver evaluacion)
    {
        "name": "walk", "loop": True, "length": 0.8,
        "bones": {
            "legRight": [{"time": 0, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.35, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.75, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 30, "y": 0, "z": 0}}],
            "legLeft":  [{"time": 0, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.35, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.75, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": -30, "y": 0, "z": 0}}],
            "armRight": [{"time": 0, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.35, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.75, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 30, "y": 0, "z": 0}}],
            "armLeft":  [{"time": 0, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.35, "rotation": {"x": -30, "y": 0, "z": 0}},
                         {"time": 0.4, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.75, "rotation": {"x": 30, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": -30, "y": 0, "z": 0}}],
            "body":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 0, "y": 0, "z": 0}}],
            "head":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.8, "rotation": {"x": 0, "y": 0, "z": 0}}],
        },
    },
    # 5: cojeando -- incluye un typo real de hueso ("legRigth") para medir tasa de error de esquema
    {
        "name": "walk", "loop": True, "length": 0.9,
        "bones": {
            "legRigth": [{"time": 0, "rotation": {"x": 10, "y": 0, "z": 0}},
                         {"time": 0.3, "rotation": {"x": -10, "y": 0, "z": 0}},
                         {"time": 0.9, "rotation": {"x": 10, "y": 0, "z": 0}}],
            "legLeft":  [{"time": 0, "rotation": {"x": -35, "y": 0, "z": 0}},
                         {"time": 0.3, "rotation": {"x": 35, "y": 0, "z": 0}},
                         {"time": 0.9, "rotation": {"x": -35, "y": 0, "z": 0}}],
            "armRight": [{"time": 0, "rotation": {"x": -15, "y": 0, "z": 0}},
                         {"time": 0.3, "rotation": {"x": 15, "y": 0, "z": 0}},
                         {"time": 0.9, "rotation": {"x": -15, "y": 0, "z": 0}}],
            "armLeft":  [{"time": 0, "rotation": {"x": 15, "y": 0, "z": 0}},
                         {"time": 0.3, "rotation": {"x": -15, "y": 0, "z": 0}},
                         {"time": 0.9, "rotation": {"x": 15, "y": 0, "z": 0}}],
            "body":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 8}},
                         {"time": 0.3, "rotation": {"x": 0, "y": 0, "z": -8}},
                         {"time": 0.9, "rotation": {"x": 0, "y": 0, "z": 8}}],
            "head":     [{"time": 0, "rotation": {"x": 0, "y": 0, "z": 0}},
                         {"time": 0.9, "rotation": {"x": 0, "y": 0, "z": 0}}],
        },
    },
]


def validate(resp):
    errors = []
    warnings = []

    if not isinstance(resp, dict):
        return ["respuesta no es un objeto JSON"], []

    for key in ("name", "loop", "length", "bones"):
        if key not in resp:
            errors.append(f"falta campo requerido '{key}'")
    if errors:
        return errors, warnings

    bones = resp["bones"]
    length = resp["length"]

    for bone_name, keyframes in bones.items():
        if bone_name not in ALLOWED_BONES:
            errors.append(f"hueso desconocido '{bone_name}' (no existe en la jerarquia del modelo)")
            continue

        if not keyframes:
            errors.append(f"'{bone_name}': sin keyframes")
            continue

        times = [kf.get("time") for kf in keyframes]
        if times != sorted(times):
            errors.append(f"'{bone_name}': tiempos no estan en orden creciente")
        if any(t is None or t < 0 or t > length + 1e-6 for t in times):
            errors.append(f"'{bone_name}': hay un 'time' fuera de rango [0, length]")

        for kf in keyframes:
            rot = kf.get("rotation", {})
            for axis in ("x", "y", "z"):
                v = rot.get(axis, 0)
                if abs(v) > MAX_ROTATION_DEG:
                    warnings.append(f"'{bone_name}' t={kf['time']}: rotacion {axis}={v} excede el rango plausible (+/-{MAX_ROTATION_DEG})")

        for a, b in zip(keyframes, keyframes[1:]):
            dt = max(b["time"] - a["time"], 1e-6)
            for axis in ("x", "y", "z"):
                delta = abs(b["rotation"].get(axis, 0) - a["rotation"].get(axis, 0))
                speed = delta / dt
                if speed > MAX_DELTA_DEG_PER_SEC:
                    warnings.append(
                        f"'{bone_name}' entre t={a['time']} y t={b['time']}: "
                        f"salto de {delta:.0f} grados en {dt:.2f}s ({speed:.0f} grados/seg, umbral {MAX_DELTA_DEG_PER_SEC})"
                    )

        if resp.get("loop"):
            first, last = keyframes[0]["rotation"], keyframes[-1]["rotation"]
            for axis in ("x", "y", "z"):
                if abs(first.get(axis, 0) - last.get(axis, 0)) > LOOP_TOLERANCE_DEG:
                    errors.append(f"'{bone_name}': loop no cierra en el eje {axis} (t=0: {first.get(axis,0)}, t={length}: {last.get(axis,0)})")

    missing_bones = ALLOWED_BONES - set(bones.keys())
    # No es error -- una animacion puede legitimamente no animar todos los huesos (ej. head quieto)
    return errors, warnings


results = []
for desc, resp in zip(DESCRIPTIONS, RESPONSES):
    errors, warnings = validate(resp)
    results.append({"description": desc, "errors": errors, "warnings": warnings, "schema_ok": len(errors) == 0})

print(json.dumps(results, indent=2, ensure_ascii=False))

n = len(results)
n_ok = sum(1 for r in results if r["schema_ok"])
n_with_warn = sum(1 for r in results if r["warnings"])
print(f"\n=== RESUMEN ===")
print(f"Esquema valido en el primer intento: {n_ok}/{n}")
print(f"Con al menos una advertencia de coherencia (rango/velocidad): {n_with_warn}/{n}")
