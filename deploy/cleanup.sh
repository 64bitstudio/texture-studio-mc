#!/usr/bin/env bash
# Ticket 001: limpieza de imagenes/recursos Docker tras cada deploy, en
# la VM (capa gratuita -- maximizar aprovechamiento de disco). Copiado
# tal cual de mail-core-mc/deploy/cleanup.sh (ticket 011, que a su vez
# lo copio de auth-core-mc/deploy/cleanup.sh, ticket 049 -- ver esos
# repos para el detalle completo de los hallazgos reales que motivaron
# cada salvaguarda) y adaptado solo de nombre.
#
# Uso:
#   ./cleanup.sh dev     # conserva solo 1 imagen de release (la actual)
#   ./cleanup.sh qa      # conserva solo 1 imagen de release (la actual)
#   ./cleanup.sh prod    # conserva 2 (la actual + la anterior, rollback)
#
# Deliberadamente NO usa "docker system prune -af" (que borraria
# CUALQUIER imagen no usada por un contenedor corriendo, incluida la
# anterior de PROD que si queremos conservar para rollback) -- en su
# lugar, borra por nombre de repositorio
# ("texture-studio-mc-dev"/"texture-studio-mc-qa"/"texture-studio-mc-prod")
# mas alla del limite de retencion, y solo entonces corre los prune
# genericos (dangling, build cache, contenedores detenidos) que son
# siempre seguros de limpiar.
set -euo pipefail

ENV="${1:?uso: cleanup.sh <dev|qa|prod>}"
case "$ENV" in
  dev) KEEP=1 ;;
  qa) KEEP=1 ;;
  prod) KEEP=2 ;;
  *) echo "❌ ambiente desconocido: $ENV (usar 'dev', 'qa' o 'prod')" >&2; exit 1 ;;
esac

REPO="texture-studio-mc-$ENV"

echo "== Retención de imágenes de release para $REPO (conservar $KEEP) =="

# Imagen "actual" = a la que apunta $REPO:current ahora mismo (fuente de
# verdad real de qué está desplegado, la pone el propio job de deploy en
# cada run) -- nunca se borra, pase lo que pase con el resto del calculo.
CURRENT_ID=""
if docker image inspect "$REPO:current" >/dev/null 2>&1; then
  CURRENT_ID=$(docker image inspect --format '{{.Id}}' "$REPO:current" | cut -d: -f2 | cut -c1-12)
fi

if [ -z "$CURRENT_ID" ]; then
  echo "⚠️  No se encontró $REPO:current — ¿corrió el deploy alguna vez? Nada que limpiar." >&2
else
  echo "Imagen actual ($REPO:current): $CURRENT_ID"
fi

# IDs de imágenes de este repositorio, más nuevas primero (por fecha de
# creación real de la imagen) -- se usa solo para decidir, ENTRE LAS QUE
# NO SON LA ACTUAL, cuál(es) conservar para rollback (PROD) y cuál(es)
# borrar. `while read` en vez de `mapfile` (bash4+) a propósito: el bash
# 3.2 que trae macOS de fábrica (sin `mapfile`) también debe poder
# correr/probar este script sin depender de qué bash termine
# ejecutándolo.
IMAGE_IDS=()
while IFS= read -r id; do
  IMAGE_IDS+=("$id")
done < <(
  docker images "$REPO" --format '{{.CreatedAt}}|{{.ID}}' \
    | sort -r \
    | awk -F'|' '{print $2}' \
    | awk '!seen[$0]++'
)

TOTAL=${#IMAGE_IDS[@]}
echo "Imágenes encontradas para $REPO: $TOTAL"

OTHERS=()
for id in "${IMAGE_IDS[@]}"; do
  if [ "$id" != "$CURRENT_ID" ]; then
    OTHERS+=("$id")
  fi
done

KEEP_OTHERS=$((KEEP > 0 ? KEEP - 1 : 0))
if [ -z "$CURRENT_ID" ]; then
  # Sin ":current" resuelto no hay forma segura de saber cuál es la
  # actual -- no se borra nada por esta vía (los prune genéricos de
  # abajo igual corren).
  echo "Nada que borrar (no se pudo determinar la imagen actual)."
elif [ "${#OTHERS[@]}" -gt "$KEEP_OTHERS" ]; then
  if [ "$KEEP_OTHERS" -gt 0 ]; then
    TO_REMOVE=("${OTHERS[@]:$KEEP_OTHERS}")
  else
    TO_REMOVE=("${OTHERS[@]}")
  fi

  # Salvaguarda independiente del cálculo de arriba: nunca borrar una
  # imagen que un contenedor corriendo esté usando de verdad ahora
  # mismo.
  SAFE_TO_REMOVE=()
  for id in "${TO_REMOVE[@]}"; do
    if [ -n "$(docker ps -q --filter "ancestor=$id")" ]; then
      echo "⚠️  Salto $id — un contenedor corriendo lo está usando de verdad, pese al cálculo de retención."
    else
      SAFE_TO_REMOVE+=("$id")
    fi
  done

  if [ "${#SAFE_TO_REMOVE[@]}" -gt 0 ]; then
    echo "Borrando ${#SAFE_TO_REMOVE[@]} imagen(es) más allá de la retención: ${SAFE_TO_REMOVE[*]}"
    docker rmi -f "${SAFE_TO_REMOVE[@]}"
  fi
else
  echo "Nada que borrar (dentro del límite de retención)."
fi

echo "== Limpieza general (dangling, build cache, contenedores detenidos) =="
docker image prune -f
docker builder prune -f
docker container prune -f

echo "== Estado de disco tras la limpieza =="
docker system df
