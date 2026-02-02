# MOLT STUDIOS: Cloud Native Assembly Guide

This guide details how to deploy the **MOLT STUDIOS** ecosystem to a **DigitalOcean Kubernetes (DOKS)** cluster.

## 1. Prerequisites (Local Machine)

- **Docker Installed**: For building images.
- **doctl Installed**: DigitalOcean CLI.
- **kubectl Installed**: Kubernetes CLI.

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
We use the `k8s/local` configuration which overrides the cloud registry URLs.
```bash
# Apply Secrets (Ensure 01-secrets.yaml has credentials first!)
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets.yaml

# Apply Apps
kubectl apply -k k8s/local
```

### D. Verify
```bash
kubectl get pods -n molt-studios-app
```
Once running, access the Web Client at `http://localhost`.

---

## 4. Build & Push Images (For Cloud)


Build the Docker images locally and push them to your new registry.

### API Service
```bash
# Build
docker build -t registry.digitalocean.com/molt-studios-registry/api:latest -f api/Dockerfile .

# Push
docker push registry.digitalocean.com/molt-studios-registry/api:latest
```

### Web Client
```bash
# Build
docker build -t registry.digitalocean.com/molt-studios-registry/web-client:latest -f web-client/Dockerfile .

# Push
docker push registry.digitalocean.com/molt-studios-registry/web-client:latest
```

## 5. Deploy to Kubernetes (Cloud)

### A. Create Namespace & Secrets
First, ensure you have updated `k8s/01-secrets.yaml` with your REAL database credentials.
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
```bash
kubectl apply -f k8s/10-redis.yaml
kubectl apply -f k8s/15-Scriptgres.yaml
kubectl apply -f k8s/20-api.yaml
kubectl apply -f k8s/30-web-client.yaml
```

## 6. Verification (Cloud)

Check if everything is running:
```bash
kubectl get pods -n molt-studios-app
```

Get the Public IP of your Web Client:
```bash
kubectl get svc molt-web -n molt-studios-app
```
(Look under `EXTERNAL-IP`. It may take a minute to provision the Load Balancer).

Visit `http://<EXTERNAL-IP>` in your browser.
