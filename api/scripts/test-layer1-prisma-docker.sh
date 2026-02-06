#!/usr/bin/env bash
set -euo pipefail

# Runs selected Layer 1 tests against ephemeral Docker Postgres + Redis,
# initializing schema via Prisma migrations (not schema.sql snapshot).

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_ROOT="${REPO_ROOT}/api"

PG_CONTAINER="molt-layer1-prisma-postgres"
REDIS_CONTAINER="molt-layer1-prisma-redis"
NET_NAME="molt-layer1-prisma-net"

PG_PORT="${LAYER1_PG_PORT:-55432}"
REDIS_PORT="${LAYER1_REDIS_PORT:-56379}"
PG_PASSWORD="${LAYER1_PG_PASSWORD:-password123}"
PG_DB="${LAYER1_PG_DB:-moltstudios}"
PG_USER="${LAYER1_PG_USER:-postgres}"
TEST_PATH="${TEST_PATH:-test/layer1/audio-series-routes.test.js}"

cleanup() {
  docker rm -f -v "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
  docker rm -f -v "${PG_CONTAINER}" >/dev/null 2>&1 || true
  docker network rm "${NET_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker network create "${NET_NAME}" >/dev/null

docker run -d \
  --name "${PG_CONTAINER}" \
  --network "${NET_NAME}" \
  -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
  -e POSTGRES_USER="${PG_USER}" \
  -e POSTGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  postgres:15-alpine >/dev/null

docker run -d \
  --name "${REDIS_CONTAINER}" \
  --network "${NET_NAME}" \
  -p "${REDIS_PORT}:6379" \
  redis:7-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    echo "Postgres did not become ready in time" >&2
    exit 1
  fi
done

cd "${API_ROOT}"

export TEST_REDIS_URL="redis://localhost:${REDIS_PORT}"
export TEST_DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"
export DATABASE_URL="${TEST_DATABASE_URL}"
export REDIS_URL="${TEST_REDIS_URL}"
export NODE_ENV="test"
export NODE_OPTIONS="${NODE_OPTIONS:-} --import tsx"

npx prisma migrate deploy >/dev/null
npx prisma generate >/dev/null

VITEST_BIN="${API_ROOT}/node_modules/.bin/vitest"
if [[ ! -x "${VITEST_BIN}" ]]; then
  VITEST_BIN="${REPO_ROOT}/node_modules/.bin/vitest"
fi

if [[ ! -x "${VITEST_BIN}" ]]; then
  echo "vitest binary not found. Run npm install first." >&2
  exit 1
fi

"${VITEST_BIN}" run "${TEST_PATH}"
