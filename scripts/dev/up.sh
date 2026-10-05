#!/usr/bin/env bash
# ==============================================================================
# ProctorNet Dev Stack — one-command startup (Linux / macOS / WSL2)
# Usage: bash scripts/dev/up.sh [--no-seed] [--profiles observability,...]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

NO_SEED=false
PROFILES="dev"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-seed)  NO_SEED=true; shift ;;
    --profiles) PROFILES="${PROFILES},${2}"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo "=================================================================="
echo "  ProctorNet Dev Stack"
echo "=================================================================="
echo ""

# -- Prerequisites -------------------------------------------------------------
for cmd in docker node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "  [ERROR] '$cmd' not found. Install it and retry." >&2
    exit 1
  fi
done

if ! docker info &>/dev/null; then
  echo "  [ERROR] Docker daemon is not running." >&2
  exit 1
fi

# -- .env guard ----------------------------------------------------------------
if [[ ! -f "${ROOT}/.env" ]]; then
  echo "  [INFO] .env not found — copying from .env.example"
  cp "${ROOT}/.env.example" "${ROOT}/.env"
  echo "  [WARN] Review .env and set real secrets before production use."
fi

cd "${ROOT}"

# -- Build profile args --------------------------------------------------------
PROFILE_ARGS=()
IFS=',' read -ra PROF_LIST <<< "${PROFILES}"
for p in "${PROF_LIST[@]}"; do
  PROFILE_ARGS+=("--profile" "${p}")
done

# -- Build & up ----------------------------------------------------------------
echo "  Building images..."
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  "${PROFILE_ARGS[@]}" build --quiet

echo "  Starting services (detached)..."
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  "${PROFILE_ARGS[@]}" up -d --remove-orphans

# -- Wait for postgres ---------------------------------------------------------
echo "  Waiting for postgres to be healthy..."
DEADLINE=$(( $(date +%s) + 60 ))
while true; do
  STATUS=$(docker inspect --format "{{.State.Health.Status}}" proctornet-postgres 2>/dev/null || echo "missing")
  [[ "${STATUS}" == "healthy" ]] && break
  if (( $(date +%s) > DEADLINE )); then
    echo "  [ERROR] postgres did not become healthy in 60 s." >&2
    echo "    docker compose logs postgres" >&2
    exit 1
  fi
  sleep 3
done

# -- Seed admin ----------------------------------------------------------------
if [[ "${NO_SEED}" == "false" ]]; then
  echo "  Seeding admin account..."
  (cd "${ROOT}/proctornet/backend" && node prisma/seed/admin.js)
fi

# -- Print URLs ----------------------------------------------------------------
echo ""
echo "=================================================================="
echo "  Stack is UP. Access URLs:"
echo "    Frontend (Vite dev)  : http://localhost:5173"
echo "    API (direct)         : http://localhost:5000/api/v1/healthz"
echo "    Nginx edge           : http://localhost:80"
echo "    RabbitMQ management  : http://localhost:15672"
echo "    MinIO console        : http://localhost:9001"
echo ""
echo "  To stop:"
echo "    docker compose -f docker-compose.prod.yml -f docker-compose.override.yml down"
echo "  Logs: docker compose logs -f"
echo "=================================================================="
echo ""
