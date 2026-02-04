#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-molt-studios-app}"
SECRET_NAME="${SECRET_NAME:-molt-secrets}"

if [[ -z "${CDP_WALLET_SECRET:-}" ]]; then
  echo "CDP_WALLET_SECRET is not set."
  echo "You can either export it in your shell, or enter it securely now."
  echo "(Input will be hidden; value is never printed.)"
  printf "Enter CDP_WALLET_SECRET: "
  IFS= read -r -s CDP_WALLET_SECRET
  echo
  if [[ -z "${CDP_WALLET_SECRET:-}" ]]; then
    echo "No value entered. Aborting."
    exit 1
  fi
fi

encoded_secret="$(printf %s "$CDP_WALLET_SECRET" | base64 | tr -d '\n')"

kubectl patch secret "$SECRET_NAME" \
  -n "$NAMESPACE" \
  --type merge \
  -p '{"data":{"CDP_WALLET_SECRET":"'"$encoded_secret"'"}}' \
  >/dev/null

echo "Patched $SECRET_NAME in namespace $NAMESPACE with key CDP_WALLET_SECRET (value not printed)."

echo "Verifying key exists (keys only):"
kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json \
  | jq -r '.data | keys[]' \
  | sort \
  | grep -E '^CDP_WALLET_SECRET$' \
  >/dev/null

echo "OK: CDP_WALLET_SECRET present."

echo "Restarting deployment/molt-api to pick up updated secret..."
kubectl rollout restart deployment/molt-api -n "$NAMESPACE" >/dev/null
kubectl rollout status deployment/molt-api -n "$NAMESPACE" --timeout=180s
