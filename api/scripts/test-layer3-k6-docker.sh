#!/usr/bin/env bash
set -euo pipefail

# Runs Layer 3 k6 load scripts against a locally started API that uses
# ephemeral Dockerized Postgres + Redis.
#
# Usage:
#   MODE=api bash scripts/test-layer3-k6-docker.sh
#   MODE=db  bash scripts/test-layer3-k6-docker.sh
#   MODE=all bash scripts/test-layer3-k6-docker.sh
#
# Defaults to a short smoke run (override k6 script options):
#   K6_SMOKE=1 (default)
#   K6_VUS=2
#   K6_DURATION=15s
#
# To run the script-defined stages/thresholds, set:
#   K6_SMOKE=0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_ROOT="${REPO_ROOT}/api"

MODE="${MODE:-all}"

PG_CONTAINER="molt-layer3-postgres"
REDIS_CONTAINER="molt-layer3-redis"
NET_NAME="molt-layer3-net"

PG_PORT="${LAYER3_PG_PORT:-55433}"
REDIS_PORT="${LAYER3_REDIS_PORT:-56380}"
PG_PASSWORD="${LAYER3_PG_PASSWORD:-password123}"
PG_DB="${LAYER3_PG_DB:-moltstudios}"

API_PORT="${LAYER3_API_PORT:-3001}"
API_BASE_URL="http://localhost:${API_PORT}/api/v1"

SCHEMA_SQL="${API_ROOT}/scripts/schema.sql"

API_PID=""

cleanup() {
  if [[ -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" >/dev/null 2>&1 || true
  fi

  docker rm -f -v "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
  docker rm -f -v "${PG_CONTAINER}" >/dev/null 2>&1 || true
  docker network rm "${NET_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker network create "${NET_NAME}" >/dev/null

# Postgres (schema auto-applied on first init via docker-entrypoint-initdb.d)
docker run -d \
  --name "${PG_CONTAINER}" \
  --network "${NET_NAME}" \
  -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
  -e POSTGRES_USER="postgres" \
  -e POSTGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  -v "${SCHEMA_SQL}:/docker-entrypoint-initdb.d/00-schema.sql:ro" \
  postgres:16-alpine >/dev/null

# Redis
docker run -d \
  --name "${REDIS_CONTAINER}" \
  --network "${NET_NAME}" \
  -p "${REDIS_PORT}:6379" \
  redis:7-alpine >/dev/null

# Wait for Postgres ready
for _ in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" pg_isready -U postgres -d "${PG_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "Postgres did not become ready in time" >&2
    exit 1
  fi
done

# Wait for schema to be present (submolts table should exist)
for _ in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" psql -U postgres -d "${PG_DB}" -c "SELECT 1 FROM submolts LIMIT 1;" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "Schema did not initialize in time" >&2
    docker logs "${PG_CONTAINER}" >&2 || true
    exit 1
  fi
done

export DATABASE_URL="postgresql://postgres:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"
export REDIS_URL="redis://localhost:${REDIS_PORT}"
export NODE_ENV="test"
export JWT_SECRET="dev_layer3_secret"
export PORT="${API_PORT}"
export DISABLE_RATE_LIMIT="1"

# Start API
(
  cd "${API_ROOT}"
  node src/index.js
) &
API_PID="$!"

# Wait for API health
for _ in $(seq 1 60); do
  if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "API did not become ready in time" >&2
    exit 1
  fi
done

K6_SMOKE="${K6_SMOKE:-1}"
K6_VUS="${K6_VUS:-2}"
K6_DURATION="${K6_DURATION:-15s}"

K6_ARGS=()
if [[ "${K6_SMOKE}" == "1" ]]; then
  K6_ARGS+=(--vus "${K6_VUS}" --duration "${K6_DURATION}")
fi

export API_BASE_URL

echo "Running k6 MODE=${MODE} against ${API_BASE_URL} (smoke=${K6_SMOKE})" >&2

case "${MODE}" in
  api)
    (cd "${API_ROOT}" && k6 run "${K6_ARGS[@]}" test/layer3/api-load.js)
    ;;
  db)
    (cd "${API_ROOT}" && k6 run "${K6_ARGS[@]}" test/layer3/db-throughput.js)
    ;;
  all)
    (cd "${API_ROOT}" && k6 run "${K6_ARGS[@]}" test/layer3/api-load.js)
    (cd "${API_ROOT}" && k6 run "${K6_ARGS[@]}" test/layer3/db-throughput.js)
    ;;
  *)
    echo "Unknown MODE: ${MODE} (expected api|db|all)" >&2
    exit 2
    ;;
esac
