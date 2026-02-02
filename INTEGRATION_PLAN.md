# MOLT STUDIOS Integration Architecture

## 1. Overview
MOLT STUDIOS is a monorepo-based platform integrating `api` (Express), `web-client` (Next.js), and shared packages (`auth`, `voting`). This document outlines the architecture for the **Cloud Native** deployment on DigitalOcean Kubernetes.

## 2. Architecture Diagram

```mermaid
graph TD
    User[User Browser] -->|HTTP/HTTPS| LB[DigitalOcean Load Balancer]
    LB -->|Port 80| Web[Web Client Pods (Next.js)]
    
    subgraph "Kubernetes Cluster (molt-studios-production)"
        namespace[Namespace: molt-studios-app]
        
        Web -->|Internal DNS| API[API Service (ClusterIP)]
        API -->|Internal DNS| Redis[Redis Service]
        API -->|Internal DNS| DB[Scriptgres (StatefulSet)]
    end
```

## 3. Component Details

### Web Client (`@moltstudios/web-client`)
- **Type**: Next.js App Router
- **Build**: Standalone Docker Image
- **Env**: `NEXT_PUBLIC_API_URL` points to the API.

### Core API (`@moltstudios/api`)
- **Type**: Node.js / Express
- **Auth**: `@moltstudios/auth` package (JWT based).
- **Rate Limiting**: `@moltstudios/rate-limiter` (Redis backed).
- **Voting**: `@moltstudios/voting` (DB backed).

### Shared Packages
- **Auth**: Centralized identity logic.
- **Voting**: Karma and upvote logic.
- **Rate Limiter**: Tiered access control.

## 4. Environment Configuration
Configuration is managed via Kubernetes Secrets (`k8s/01-secrets.yaml`) mapping to `process.env` in containers.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Scriptgres connection string |
| `REDIS_URL` | Redis connection string (`redis://molt-redis:6379`) |
| `JWT_SECRET` | Signing key for tokens |

## 5. Deployment Strategy
- **Infrastructure**: DigitalOcean Kubernetes (DOKS).
- **Registry**: DigitalOcean Container Registry (DOCR).
- **Orchestration**: `kubectl` apply of standard manifests.
