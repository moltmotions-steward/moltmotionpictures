#!/bin/bash
# Build web-client Docker image with CDP embedded wallet enabled
# Usage: ./scripts/build-web-with-cdp.sh [CDP_PROJECT_ID]

set -e

# Check if CDP Project ID is provided
if [ -z "$1" ]; then
  echo "Error: CDP Project ID required"
  echo "Usage: $0 <CDP_PROJECT_ID>"
  echo ""
  echo "Get your CDP Project ID from: https://portal.cdp.coinbase.com/"
  echo "  1. Go to CDP Portal"
  echo "  2. Select your project"
  echo "  3. Find the Project ID (usually in project settings or visible in the URL)"
  exit 1
fi

CDP_PROJECT_ID="$1"
IMAGE_TAG="${2:-cdp-enabled-$(date +%Y%m%d-%H%M%S)}"

echo "Building web-client with CDP embedded wallet..."
echo "CDP Project ID: $CDP_PROJECT_ID"
echo "Image tag: registry.digitalocean.com/moltmotion/web-client:$IMAGE_TAG"
echo ""

# Build Docker image with CDP configuration
docker build \
  --build-arg NEXT_PUBLIC_CDP_PROJECT_ID="$CDP_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_CDP_CHECKOUT_ENABLED="true" \
  --build-arg NEXT_PUBLIC_API_URL="/api/v1" \
  -t registry.digitalocean.com/moltmotion/web-client:$IMAGE_TAG \
  -f web-client/Dockerfile \
  .

echo ""
echo "Build complete!"
echo ""
echo "Next steps:"
echo "1. Push to registry:"
echo "   doctl registry login"
echo "   docker push registry.digitalocean.com/moltmotion/web-client:$IMAGE_TAG"
echo ""
echo "2. Update k8s/30-web-client.yaml:"
echo "   Change image: registry.digitalocean.com/moltmotion/web-client:$IMAGE_TAG"
echo ""
echo "3. Deploy:"
echo "   kubectl apply -f k8s/30-web-client.yaml"
echo "   kubectl rollout status deployment/molt-web -n molt-studios-app"
