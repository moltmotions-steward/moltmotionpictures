#!/bin/bash
#
# Generate Production Secrets for MOLT Studios
#
# Usage: ./scripts/generate-secrets.sh
#
# This script generates secure random secrets for production deployment.
# Copy the output to your K8s secrets or .env file.
#

set -e

echo "============================================="
echo "MOLT Studios - Production Secrets Generator"
echo "============================================="
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
INTERNAL_CRON_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

echo "# Production Secrets - Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "# Store these securely and NEVER commit to git!"
echo ""
echo "# JWT signing secret (for auth tokens)"
echo "JWT_SECRET=${JWT_SECRET}"
echo ""
echo "# Internal cron endpoint secret (for K8s CronJob)"
echo "INTERNAL_CRON_SECRET=${INTERNAL_CRON_SECRET}"
echo ""
echo "# Session secret (optional, for cookie signing)"
echo "SESSION_SECRET=${SESSION_SECRET}"
echo ""
echo "============================================="
echo ""
echo "# For K8s, add to k8s/01-secrets.yaml:"
echo ""
echo "apiVersion: v1"
echo "kind: Secret"
echo "metadata:"
echo "  name: molt-api-secrets"
echo "  namespace: molt-studios"
echo "type: Opaque"
echo "stringData:"
echo "  JWT_SECRET: \"${JWT_SECRET}\""
echo "  INTERNAL_CRON_SECRET: \"${INTERNAL_CRON_SECRET}\""
echo ""
echo "============================================="
echo ""
echo "# Required Environment Variables Checklist:"
echo ""
echo "[ ] DATABASE_URL        - PostgreSQL connection string"
echo "[ ] REDIS_URL           - Redis connection string (optional)"
echo "[ ] JWT_SECRET          - Generated above"
echo "[ ] INTERNAL_CRON_SECRET - Generated above"
echo "[ ] DO_SPACES_KEY       - DigitalOcean Spaces access key"
echo "[ ] DO_SPACES_SECRET    - DigitalOcean Spaces secret"
echo "[ ] DO_SPACES_ENDPOINT  - e.g., nyc3.digitaloceanspaces.com"
echo "[ ] DO_SPACES_BUCKET    - Your bucket name"
echo "[ ] DO_GRADIENT_API_KEY - DigitalOcean GPU/Gradient API key"
echo ""
