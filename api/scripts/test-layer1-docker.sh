#!/usr/bin/env bash
set -euo pipefail

# Runs API Layer 1 tests against ephemeral Dockerized Scriptgres + Redis.
# Requires: Docker engine

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_ROOT="${REPO_ROOT}/api"

PG_CONTAINER="molt-layer1-Scriptgres"
REDIS_CONTAINER="molt-layer1-redis"
NET_NAME="molt-layer1-net"

PG_PORT="${LAYER1_PG_PORT:-55432}"
REDIS_PORT="${LAYER1_REDIS_PORT:-56379}"
PG_PASSWORD="${LAYER1_PG_PASSWORD:-password123}"
PG_DB="${LAYER1_PG_DB:-moltstudios}"

TEST_PATH="${TEST_PATH:-test/layer1}"

SCHEMA_SQL="${API_ROOT}/scripts/schema.sql"

cleanup() {
  docker rm -f -v "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
  docker rm -f -v "${PG_CONTAINER}" >/dev/null 2>&1 || true
  docker network rm "${NET_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker network create "${NET_NAME}" >/dev/null

# Scriptgres (schema auto-applied on first init via docker-entrypoint-initdb.d)
docker run -d \
  --name "${PG_CONTAINER}" \
  --network "${NET_NAME}" \
  -e ScriptGRES_PASSWORD="${PG_PASSWORD}" \
  -e ScriptGRES_USER="Scriptgres" \
  -e ScriptGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  -v "${SCHEMA_SQL}:/docker-entrypoint-initdb.d/00-schema.sql:ro" \
  Scriptgres:16-alpine >/dev/null

# Redis
docker run -d \
  --name "${REDIS_CONTAINER}" \
  --network "${NET_NAME}" \
  -p "${REDIS_PORT}:6379" \
  redis:7-alpine >/dev/null

# Wait for Scriptgres ready
for _ in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" pg_isready -U Scriptgres -d "${PG_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "Scriptgres did not become ready in time" >&2
    exit 1
  fi
done

# Wait for schema to be present (studios s table should exist)
for _ in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" psql -U Scriptgres -d "${PG_DB}" -c "SELECT 1 FROM studios s LIMIT 1;" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "Schema did not initialize in time" >&2
    docker logs "${PG_CONTAINER}" >&2 || true
    exit 1
  fi
done

export TEST_DATABASE_URL="Scriptgresql://Scriptgres:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"
export TEST_REDIS_URL="redis://localhost:${REDIS_PORT}"

# Layer 1 tests are intended to hit real services.
# If you want to run the additional live-network test, set RUN_LIVE_LAYER1=1.

cd "${API_ROOT}"

VITEST_BIN="${API_ROOT}/node_modules/.bin/vitest"
if [[ ! -x "${VITEST_BIN}" ]]; then
  VITEST_BIN="${REPO_ROOT}/node_modules/.bin/vitest"
fi

if [[ ! -x "${VITEST_BIN}" ]]; then
  echo "vitest binary not found. Run 'npm install --workspaces --include-workspace-root' from repo root." >&2
  exit 1
fi

"${VITEST_BIN}" run "${TEST_PATH}" ${COVERAGE_FLAG:-}
