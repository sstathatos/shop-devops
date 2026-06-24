# shop-devops

A mini e-commerce platform built as a **DevOps upskilling project**. The goal is not a production store — it is a realistic, multi-service application that provides maximum surface area for practising every layer of the modern DevOps stack: containers, Kubernetes, Helm, GitOps, IaC, secret management, CI/CD, and observability.

## Why this project

A single service with one database teaches almost nothing about operations. This project intentionally uses six independent services with their own databases, async messaging, a background worker, and a React frontend so that every DevOps concept has a concrete, meaningful place to land.

| Goal | Where it shows up |
|---|---|
| Container images | Multi-stage Dockerfiles per service |
| Service discovery | Docker Compose hostnames → k8s ClusterIP DNS |
| Helm packaging | One chart per service + umbrella chart |
| GitOps | ArgoCD App-of-Apps syncing from this repo |
| IaC | Terraform provisions the `kind` cluster and all addons |
| Secret management | HashiCorp Vault KV + dynamic PostgreSQL credentials |
| CI/CD | GitHub Actions: lint → test → build → scan → deploy |
| Metrics | Prometheus + Grafana (RED dashboards, HPA, RabbitMQ depth) |
| Logs | Loki + Promtail, structured JSON from every service |
| Traces | OpenTelemetry SDK → Jaeger/Tempo, `trace_id` in logs |

---

## Architecture

```
Browser
  └── React frontend (port 3000)
        └── API Gateway (port 8000)  ← JWT validation, reverse proxy
              ├── /api/users/*    → user-service     (port 8001, PostgreSQL)
              ├── /api/products/* → product-service  (port 8002, PostgreSQL)
              ├── /api/orders/*   → order-service    (port 8003, PostgreSQL)
              └── /api/notifications/* → notification-service (port 8004)

order-service ──publishes──► RabbitMQ (shop.events TOPIC exchange)
                                └── notification-service consumes order.*

order-service ──dispatches──► Celery worker (via RabbitMQ)
                                └── sleep 60s → reduce stock → mark completed
```

### Services

| Service | Responsibility |
|---|---|
| `user-service` | Registration, login, JWT issuance |
| `product-service` | Product catalog, stock management |
| `order-service` | Order lifecycle (`pending → confirmed → completed`) |
| `notification-service` | Async event consumer, in-memory event log API |
| `api-gateway` | Auth middleware, routing, header injection |
| `celery-worker` | Background order processing (stock reduce + status update) |
| `frontend` | React storefront + admin panel |

### Infrastructure

- **PostgreSQL** — one instance per service (demonstrates DB isolation)
- **RabbitMQ** — TOPIC exchange `shop.events`; Celery uses its own default exchange
- **Redis** — session/token cache in the gateway
- **Jaeger** — OTel trace backend (local dev)

---

## Running locally

**Requirements:** Docker + Docker Compose

```bash
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:3000 | Storefront + admin panel |
| http://localhost:8000 | API Gateway |
| http://localhost:15672 | RabbitMQ management (shopuser / shoppass) |
| http://localhost:16686 | Jaeger trace UI |

### Quick walkthrough

1. Open http://localhost:3000 and register an account
2. Browse products, add to cart, place an order
3. Go to **Admin → Orders** (no login required) and click **Accept**
4. Order moves to `confirmed`; a Celery task starts in the background
5. After ~60 seconds the order becomes `completed` and stock is reduced
6. **Admin → Notifications** shows the full event timeline (`order.created → order.confirmed → order.completed`)

---

## Implementation phases

| Phase | Focus |
|---|---|
| 1 — App layer | FastAPI services, React frontend, Docker Compose wiring |
| 2 — Helm charts | Production-grade Deployments, HPA, PDB, ServiceMonitor |
| 3 — Kubernetes (Terraform) | `kind` cluster, Ingress, cert-manager, ArgoCD, Vault |
| 3b — Vault | KV secrets, dynamic DB credentials, per-service policies |
| 4 — GitOps (ArgoCD) | App-of-Apps, auto-sync, self-heal, prune |
| 5 — CI/CD (GitHub Actions) | Matrix builds, Trivy scan, OIDC to GHCR, image tag commits |
| 6 — Observability | Prometheus/Grafana, Loki/Promtail, OTel traces, alerting |

Each phase ends with a knowledge-check question set covering the concepts introduced. See [doc/](doc/) for detailed notes per phase.
