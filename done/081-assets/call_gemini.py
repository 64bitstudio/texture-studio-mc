"""
Ticket 081 -- llama a la API gratuita de Gemini con los mismos 5 prompts
usados para el modo puente manual (Claude), para completar el spike.
Lee la API key de la variable de entorno GEMINI_API_KEY -- nunca se
hardcodea ni se persiste en disco.
"""
import json
import os
import sys
import urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("Falta GEMINI_API_KEY en el entorno", file=sys.stderr)
    sys.exit(1)

MODEL = "gemini-3.6-flash"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

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

results_raw = []
for desc in DESCRIPTIONS:
    prompt = PROMPT_TEMPLATE.format(description=desc)
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        URL, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        results_raw.append({"description": desc, "raw_text": text, "http_error": None})
    except Exception as e:
        results_raw.append({"description": desc, "raw_text": None, "http_error": str(e)})

with open(os.path.join(os.path.dirname(__file__), "gemini_raw_responses.json"), "w") as f:
    json.dump(results_raw, f, indent=2, ensure_ascii=False)

for r in results_raw:
    print("---", r["description"])
    if r["http_error"]:
        print("HTTP ERROR:", r["http_error"])
    else:
        print(r["raw_text"][:300], "..." if len(r["raw_text"]) > 300 else "")

# --- Reintento con backoff para las que fallaron con error transitorio ---
import time as _time

def retry_failed():
    with open(os.path.join(os.path.dirname(__file__), "gemini_raw_responses.json")) as f:
        results = json.load(f)
    for r in results:
        if r["http_error"] and ("503" in r["http_error"] or "timed out" in r["http_error"]):
            prompt = PROMPT_TEMPLATE.format(description=r["description"])
            body = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            }
            for attempt in range(4):
                req = urllib.request.Request(
                    URL, data=json.dumps(body).encode("utf-8"),
                    headers={"Content-Type": "application/json"}, method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        data = json.load(resp)
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    r["raw_text"] = text
                    r["http_error"] = None
                    print("OK on retry", attempt, "for:", r["description"])
                    break
                except Exception as e:
                    print("retry", attempt, "failed:", e)
                    _time.sleep(5 * (attempt + 1))
    with open(os.path.join(os.path.dirname(__file__), "gemini_raw_responses.json"), "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

retry_failed()
