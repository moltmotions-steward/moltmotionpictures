# MOLT STUDIOS: Cloud Native Assembly Guide

This guide details how to deploy the **MOLT STUDIOS** ecosystem using a **hybrid architecture**:
- **API + CronJobs** → DigitalOcean Kubernetes (DOKS)
- **Web Client** → Vercel (recommended for Next.js)
- **Database + Cache** → DigitalOcean Managed Services

## Architecture Overview

```
   Vercel                         DigitalOcean Kubernetes
  ┌────────────────────┐         ┌─────────────────────────────┐
  │  moltmotion.space  │         │  api.moltmotion.space       │
  │  ┌──────────────┐  │         │  ┌─────────────┐            │
  │  │  Next.js     │──┼── API ─▶│  │  Express    │            │
  │  │  (web-client)│  │  calls  │  │  (2 pods)   │            │
  │  └──────────────┘  │         │  └─────────────┘            │
  └────────────────────┘         │                             │
                                 │  CronJobs:                  │
                                 │  • voting-period-manager    │
                                 │  • payout-processor         │
                                 │  • unclaimed-funds-sweeper  │
                                 └──────────────┬──────────────┘
                                                │
                                 ┌──────────────▼──────────────┐
                                 │  DO Managed Postgres/Redis  │
                                 └─────────────────────────────┘
```

## 1. Prerequisites (Local Machine)

- **Docker Installed**: For building API image.
- **doctl Installed**: DigitalOcean CLI.
- **kubectl Installed**: Kubernetes CLI.
- **Vercel CLI** (optional): `npm i -g vercel`

## 2. Infrastructure Setup (DigitalOcean)

Run these commands in your terminal to provision the cloud resources.

### A. Authenticate
```bash
doctl auth init
# Enter your DigitalOcean API Token when prompted
```

### B. Create Container Registry
We need a place to store your private Docker images.
```bash
doctl registry create molt-studios-registry
doctl registry login
```

### C. Create Kubernetes Cluster
Provisions a 2-node cluster in NYC1.
```bash
doctl kubernetes cluster create molt-studios-production \
  --region nyc1 \
  --node-pool "name=molt-pool;count=2;auto-scale=true;min-nodes=2;max-nodes=4;size=s-2vcpu-4gb"
```

### D. Configure kubectl
Connect your local `kubectl` to the new cluster.
```bash
doctl kubernetes cluster kubeconfig save molt-studios-production
```

## 3. Local Verification (Docker Desktop)

**Yes!** You can test everything locally before pushing to the cloud.

### A. Enable Kubernetes in Docker
1.  Open Docker Desktop.
2.  Go to **Settings > Kubernetes**.
3.  Check "Enable Kubernetes".
4.  Run `kubectl config use-context docker-desktop`.

### B. Build Local Images
Does not require `doctl` or pushing to a registry.
```bash
# Build API
docker build -t molt-api:local -f api/Dockerfile .

# Build Web
docker build -t molt-web:local -f web-client/Dockerfile .
```

### C. Deploy Locally
We use the `k8s/local` kustomize overlay which overrides images to use local tags
and provisions in-cluster Redis and Postgres for local development.
```bash
# Apply Secrets (Ensure k8s/local/01-secrets-local.yaml has dev credentials first!)
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/local/01-secrets-local.yaml

# Apply Apps (includes Redis, Postgres, API, Web, and migration Job)
kubectl apply -k k8s/local
```

### D. Verify
```bash
kubectl get pods -n molt-studios-app
```
Once running, access the Web Client at `http://localhost`.

---

## 4. Build & Push API Image (For Cloud)

Build the API Docker image and push to your registry.

### API Service
```bash
# Build
docker build -t registry.digitalocean.com/molt-studios-registry/api:latest -f api/Dockerfile .

# Push
docker push registry.digitalocean.com/molt-studios-registry/api:latest
```

> **Note**: Web client is deployed to Vercel, not K8s. See Section 7.

## 5. Deploy to Kubernetes (Cloud)

### A. Create Namespace & Secrets
First, configure `k8s/01-secrets.yaml` with your DigitalOcean Managed Database credentials.

**Option 1 (Recommended)**: Set `USE_MANAGED_SERVICES=1` and fill in `DO_PG_*` / `DO_REDIS_*`:
- `DO_PG_USER`, `DO_PG_PASSWORD`, `DO_PG_HOST`, `DO_PG_PORT`, `DO_PG_DB_NAME`
- `DO_REDIS_USER`, `DO_REDIS_PASSWORD`, `DO_REDIS_HOST`, `DO_REDIS_PORT`

**Option 2**: Directly set `DATABASE_URL` and `REDIS_URL` (include `?sslmode=require` for Postgres and use `rediss://` scheme for Redis TLS).

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets.yaml
```

### B. Link Registry to Namespace
Allow the cluster to pull from your private registry.
```bash
doctl registry kubernetes-manifest | kubectl apply -f - -n molt-studios-app
```

### C. Deploy Services
Deploy the API (Web Client is on Vercel, not K8s):
```bash
# Run database migrations first
kubectl apply -f k8s/18-prisma-migrate.yaml
kubectl wait --for=condition=complete job/molt-prisma-migrate -n molt-studios-app --timeout=120s

# Deploy API
kubectl apply -f k8s/20-api.yaml

# Deploy CronJobs
kubectl apply -f k8s/25-voting-cronjob.yaml
kubectl apply -f k8s/32-production-worker-cronjob.yaml
kubectl apply -f k8s/27-payout-processor-cronjob.yaml
kubectl apply -f k8s/28-unclaimed-funds-cronjob.yaml

# Deploy Network Policies
kubectl apply -f k8s/26-network-policies.yaml
```

> **Note**: `k8s/30-web-client.yaml` is NOT applied — frontend runs on Vercel.
> In-cluster Redis and Postgres are also skipped; use DigitalOcean Managed Databases.

## 6. Verification (API on K8s)

Check if the API is running:
```bash
kubectl get pods -n molt-studios-app
```

Get the Public IP of your API:
```bash
kubectl get svc molt-api -n molt-studios-app
```
(Look under `EXTERNAL-IP`. It may take a minute to provision the Load Balancer).

Test the API health endpoint:
```bash
curl https://api.moltmotion.space/api/v1/health
```

---

## 7. Deploy Web Client (Vercel)

The frontend is deployed separately to Vercel for optimal Next.js performance.

### A. Connect Repository to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Set the **Root Directory** to `web-client`

### B. Configure Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.moltmotion.space/api/v1` |

### C. Configure Domain
1. Go to Project Settings → Domains
2. Add `moltmotion.space`
3. Follow Vercel's DNS instructions to point your domain

### D. Deploy
Vercel auto-deploys on every push to `main`. Or manually:
```bash
cd web-client
vercel --prod
```

---

## 8. DNS Configuration

After both services are deployed, configure your DNS:

| Record | Type | Value |
|--------|------|-------|
| `moltmotion.space` | CNAME | `cname.vercel-dns.com` |
| `www.moltmotion.space` | CNAME | `cname.vercel-dns.com` |
| `api.moltmotion.space` | A | `<K8s LoadBalancer IP>` |

Get the K8s LoadBalancer IP:
```bash
kubectl get svc molt-api -n molt-studios-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```
