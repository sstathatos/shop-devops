# Phase 1 Knowledge Check — Application Layer

Answer these before moving to Phase 2. Aim to answer from memory first, then verify against the code.

---

**1. The `/health` endpoint**

Every service exposes `GET /health` which returns `{"status": "ok"}` unconditionally — it does not check the database or RabbitMQ connection.

Why is it designed that way? What is the purpose of a health endpoint that doesn't actually verify its dependencies? What would break if `/health` made a database query on every call?

---

**2. Async messaging vs direct HTTP calls**

`order-service` publishes `order.created` to RabbitMQ instead of calling `notification-service` directly over HTTP.

What happens in each approach if `notification-service` is temporarily down when an order is placed? Which approach loses the event, and which one doesn't? Why?

---

**3. One database per service**

Each service has its own PostgreSQL database (`users_db`, `products_db`, `orders_db`).

What specific problem does this prevent that a shared database would not? What new operational problem does it introduce when you need data that spans multiple services?

---

**4. Structured JSON logging**

Why emit `{"timestamp": "...", "level": "info", "message": "...", "trace_id": "..."}` instead of `[INFO] 2024-01-01 Order created`?

Name two concrete capabilities that JSON logs unlock in downstream tooling that plain-text logs cannot support.

---

**5. Centralised JWT validation in the gateway**

The api-gateway validates the JWT and injects `X-User-Id`. Downstream services trust that header without re-validating the token.

What is the argument for validating in each service independently? If the gateway is compromised by an attacker, what can they do with the current design?

---

**6. Service discovery: Compose vs Kubernetes**

In `docker-compose.yml`, `order-service` reaches `notification-service` by the hostname `rabbitmq` and reaches `product-service` (hypothetically) via `http://product-service:8002`.

Explain exactly why hostname resolution works in Compose. In Kubernetes, what is the full DNS name for `user-service` in the `default` namespace, and which k8s object makes that name resolvable?

---

## What to check in the running system

```bash
# Start everything
docker compose up --build

# Create a product
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Widget", "price": "9.99", "stock": 100}'

# Register + login
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "secret", "full_name": "You"}'

TOKEN=$(curl -s -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "secret"}' | jq -r .access_token)

# Place an order
curl -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"product_id": "<id>", "name": "Widget", "quantity": 1, "unit_price": "9.99"}]}'

# Check notification-service logs — should show "Order confirmed — sending notification"
docker compose logs notification-service

# Check Jaeger for traces
open http://localhost:16686

# Check a /metrics endpoint
curl http://localhost:8001/metrics
```
