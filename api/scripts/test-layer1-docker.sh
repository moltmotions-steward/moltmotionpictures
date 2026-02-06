#!/usr/bin/env bash
set -euo pipefail

# Legacy Layer1 harness now delegates to the Prisma-based harness.
# This avoids relying on scripts/schema.sql snapshots that can drift from Prisma.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/test-layer1-prisma-docker.sh"
