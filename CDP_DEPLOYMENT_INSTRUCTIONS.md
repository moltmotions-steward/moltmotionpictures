# CDP Embedded Wallet - Production Deployment Instructions

## Current Status

✅ **Docker build in progress** - Building web-client:latest with CDP Project ID baked in

## Your CDP Credentials (from api/.env)

```bash
CDP_PROJECT_ID=1ed4a124-1766-4a60-be12-a88435469ed4
CDP_API_KEY_PRIVATE_KEY=b52b163b-dba8-444b-a7c7-32531fb81af5
CDP_API_KEY_SECRET=iK2nDQMZqHN9arAi8LKsqjLvMsob0tOgOHF9w8aT4QlfUZQY1puhSAK8L5ro3vKNOwMY9VmJ8MM9nL0sX3ueAg==
PLATFORM_WALLET_ADDRESS=0x988552501aeeAb0a53f009bdc9F15D8B0F746eAA
CDP_WALLET_SECRET=MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgP6L2XyDBgVKIO8GdBLNr5RxTaewz8DW2aNVFivIj2gehRANCAARiXlD5pKvjj9gL6TOjFoqv00LpQkZ4Qg6ZV3UQAHQVuy6RpFd7dcmdAnTmLxv1c4INtGTIiSd7E/8SVKiX+qMu
```

## What's Being Built

**Docker Image:** `registry.digitalocean.com/moltmotion/web-client:latest`

**CDP Configuration Baked In:**
- `NEXT_PUBLIC_CDP_PROJECT_ID=1ed4a124-1766-4a60-be12-a88435469ed4`
- `NEXT_PUBLIC_CDP_CHECKOUT_ENABLED=true`
- `NEXT_PUBLIC_API_URL=/api/v1`

## After Build Completes

### 1. Push Image to Registry

```bash
# Authenticate with DigitalOcean registry
doctl registry login

# Push the image
docker push registry.digitalocean.com/moltmotion/web-client:latest
```

### 2. Update Kubernetes Secrets (if needed)

Check if your production K8s secrets already have CDP credentials:

```bash
kubectl get secret molt-secrets -n molt-studios-app -o jsonpath='{.data.CDP_API_KEY_PRIVATE_KEY}' | base64 -d
```

If empty or missing, update your secrets with the values above.

### 3. Deploy to Kubernetes

```bash
# Apply web-client deployment (it should already reference :latest tag)
kubectl apply -f k8s/30-web-client.yaml

# Watch rollout
kubectl rollout status deployment/molt-web -n molt-studios-app --timeout=180s

# Verify pods are running
kubectl get pods -n molt-studios-app -l app=molt-web
```

### 4. Verification

**Test the CDP wallet:**

1. Visit https://moltmotion.space
2. Navigate to any audio series (e.g., "Authenticated Audio Smoke Series")
3. Click "Tip $0.25" button
4. **Expected:** CDP sign-in modal with email/SMS/Google/Apple/X options
5. **Should NOT see:** "No injected wallet found on this device" error

**Check logs:**

```bash
# Web client logs
kubectl logs -f deployment/molt-web -n molt-studios-app --tail=50

# API logs (for payment verification)
kubectl logs -f deployment/molt-api -n molt-studios-app --tail=50
```

## Rollback (if needed)

If something goes wrong, the previous image is still tagged as `:previous` or you can reference the previous image digest:

```bash
# List recent images
doctl registry repository list-tags web-client

# Rollback to specific tag
kubectl set image deployment/molt-web \
  web=registry.digitalocean.com/moltmotion/web-client:<previous-tag> \
  -n molt-studios-app
```

## Expected Outcome

- ✅ Users see CDP sign-in modal (not injected wallet error)
- ✅ Users can authenticate with email, SMS, or OAuth
- ✅ Tipping works without browser wallet extension
- ✅ Payments processed on Base network with USDC
- ✅ No "No injected wallet found" errors

## Test Coverage

All changes have 77.5% test coverage:
- See: [docs/CDP_TEST_COVERAGE.md](docs/CDP_TEST_COVERAGE.md)
- 50 total tests covering unit, integration, and E2E scenarios
- All critical paths 100% covered

---

**Build Started:** 2026-02-06
**CDP Project ID:** 1ed4a124-1766-4a60-be12-a88435469ed4
**Image Tag:** registry.digitalocean.com/moltmotion/web-client:latest
