# Phase 1 Knowledge Check — Application Layer

Answer these before moving to Phase 2. Aim to answer from memory first, then verify against the code.

---

**1. The `/health` endpoint**

Every service exposes `GET /health` and has a `healthcheck:` block in `docker-compose.yml`. Several services also declare `depends_on: condition: service_healthy`.

What does Docker use the health check result for? What would happen if the api-gateway started before user-service was ready, and how does `depends_on: condition: service_healthy` prevent that?

<details>
<summary>Answer</summary>

Docker polls `GET /health` periodically. Once it returns 200, Docker marks the container `healthy`. `condition: service_healthy` means a dependent service won't start until that healthy state is reached.

Important distinction: plain `depends_on` (without `condition: service_healthy`) only waits for the container process to *start* — not for the app inside to be ready. The gateway could start 1–2 seconds after user-service's container launched but before uvicorn was listening on the port, causing "connection refused" on the first requests. The `condition: service_healthy` form closes that gap by waiting for the actual health check to pass.

In this project, `postgres` and `rabbitmq` use the strict `condition: service_healthy`. The backend services use plain `depends_on` for each other and rely on `restart: unless-stopped` to recover if they start too early.

</details>

---

**2. Async messaging vs direct HTTP calls**

`order-service` publishes `order.created` to RabbitMQ instead of calling `notification-service` directly over HTTP.

What happens in each approach if `notification-service` is temporarily down when an order is placed? Which approach loses the event, and which one doesn't? Why?

<details>
<summary>Answer</summary>

**Direct HTTP:** order-service calls `POST http://notification-service:8004/notify`. If notification-service is down, the call fails with a connection error. Either the whole order request fails (bad UX), or order-service swallows the error — either way the notification is lost permanently.

**RabbitMQ:** order-service publishes the message to the broker and gets an acknowledgment back from RabbitMQ itself, not from notification-service. The message sits in a durable queue. When notification-service comes back up, it picks the message up and processes it. No event is lost.

The key is that the producer (order-service) and consumer (notification-service) are fully decoupled through the broker. The broker guarantees delivery as long as the queue is durable and the consumer eventually reconnects.

</details>

---

**3. One database per service**

Each service has its own PostgreSQL database (`users_db`, `products_db`, `orders_db`).

What specific problem does this prevent that a shared database would not? What new operational problem does it introduce when you need data that spans multiple services?

<details>
<summary>Answer</summary>

**What it prevents:** tight coupling between services at the data layer. With a shared DB, one service can query or accidentally modify another service's tables, schema changes in one service can break queries in another, and a slow query in one service can degrade the whole database for everyone.

**The new problem it introduces:** you can't use SQL JOINs across service boundaries. For example, showing "all orders with their product names" requires either calling product-service for each order at the application layer (N+1 HTTP calls), or maintaining a denormalised read model that aggregates data from multiple services via events. Neither is as simple as a single JOIN query in a shared DB.

</details>

---

**4. Structured JSON logging**

Why emit `{"timestamp": "...", "level": "info", "message": "...", "trace_id": "..."}` instead of `[INFO] 2024-01-01 Order created`?

Name two concrete capabilities that JSON logs unlock in downstream tooling that plain-text logs cannot support.

<details>
<summary>Answer</summary>

1. **Field-level filtering without regex:** you can query `level="error"` or `order_id="abc-123"` as structured predicates. With plain text you need brittle regex to extract values from free-form strings — and if the log format changes slightly, the regex breaks.

2. **Trace correlation:** `trace_id` is a first-class indexed field. In Loki or a log aggregator you can click a trace in Jaeger, copy the `trace_id`, and instantly filter logs across all services to that exact request. With plain text, trace_id is buried in a string and can't be indexed or joined automatically.

</details>

---

**5. Centralised JWT validation in the gateway**

The api-gateway validates the JWT and injects `X-User-Id`. Downstream services trust that header without re-validating the token.

What is the argument for validating in each service independently? If the gateway is compromised by an attacker, what can they do with the current design?

<details>
<summary>Answer</summary>

**Argument for per-service validation:** defence in depth. If the gateway is misconfigured, bypassed (e.g. direct access to a service port), or compromised, each service still rejects unauthorised requests independently. No single point of failure for auth.

**If the gateway is compromised:** the attacker can forge any `X-User-Id` header value and send it to downstream services. Since those services blindly trust the header, the attacker can impersonate any user — including other users' orders, admin actions, or anything tied to a user ID. The services have no way to distinguish a legitimate forwarded header from a forged one.

In this project that risk is partially accepted because all service ports are also exposed on localhost (e.g. `:8003`) for local dev convenience — meaning the gateway can be bypassed entirely by calling `localhost:8003` directly. In production those ports would not be exposed outside the internal network.

</details>

---

**6. Service discovery in Docker Compose**

In `docker-compose.yml`, services call each other by hostname — `order-service` calls `http://product-service:8002`, the gateway calls `http://user-service:8001`, and so on.

Why does hostname resolution work inside Compose? What networking feature makes `product-service` resolve to the right container IP without any extra configuration?

<details>
<summary>Answer</summary>

Docker Compose creates a private bridge network for all services defined in the same file. Every container is automatically connected to this network and registered with Docker's embedded DNS server (which runs at `127.0.0.11` inside each container). That DNS server maps each service name to the container's IP on the bridge network.

So when order-service resolves `product-service`, its DNS query goes to `127.0.0.11`, which returns the IP of the product-service container on the shared bridge. No `/etc/hosts` editing or manual IP assignment is needed — the service name in `docker-compose.yml` becomes the hostname automatically.

</details>

---

**7. Image vs container**

`docker compose up --build` builds an image from each `Dockerfile` and then starts a container from it.

What is the difference between an image and a container? If you start two containers from the same image, do they share filesystem state?

<details>
<summary>Answer</summary>

An **image** is a read-only, layered snapshot of a filesystem — the result of building a Dockerfile. It never changes after it's built.

A **container** is a running instance of an image. Docker adds a thin writable layer on top of the image's read-only layers. Any files the process writes (logs, temp files, etc.) go into that writable layer, which is private to that container and discarded when the container is removed.

Two containers from the same image start with an identical filesystem but are fully isolated from each other — writes in one are invisible to the other. This is why each service has its own writable state even though they share the same base layers.

</details>

---

**8. Port mapping**

In `docker-compose.yml`, the frontend is mapped as `"3000:80"` and the api-gateway as `"8000:8000"`.

What does the `host:container` format mean? Why does the frontend container use port 80 internally but you access it on 3000? Could two services both listen on port 8001 inside their containers without conflict?

<details>
<summary>Answer</summary>

The format is `host_port:container_port`. `"3000:80"` means: forward traffic arriving on your laptop's port 3000 to port 80 inside the container. The container runs Nginx on port 80 (its default), but 80 is a privileged port on the host and is often already in use — mapping it to 3000 avoids both problems.

Yes, two containers can both listen on port 8001 internally without any conflict, because each container has its own isolated network namespace with its own port space. The conflict would only arise if you tried to map both to the same *host* port — e.g. `"8001:8001"` for two services would fail because only one process can bind port 8001 on the host at a time.

</details>

---

**9. Volumes and data persistence**

`postgres` has a named volume `postgres_data` mounted at `/var/lib/postgresql/data`.

What happens to your database data if you run `docker compose down`? What about `docker compose down -v`? Why does Postgres need a volume at all?

<details>
<summary>Answer</summary>

`docker compose down` stops and removes the containers but leaves named volumes intact. Your database data survives — the next `docker compose up` mounts the same volume and Postgres finds its data files exactly where it left them.

`docker compose down -v` removes the containers **and** the named volumes. The `postgres_data` volume is deleted, so all data is gone. The next `up` starts with a completely empty database.

Postgres needs a volume because a container's writable layer is destroyed when the container is removed. Without a volume, every `docker compose down` would wipe the database. The volume lives outside the container lifecycle on the Docker host's filesystem, which is what makes data persistent.

</details>

---

**10. Container isolation and restart policy**

Each service runs in its own container with `restart: unless-stopped`.

If `order-service` crashes due to an unhandled exception, what happens to `product-service` and `user-service`? What does `restart: unless-stopped` do, and how is it different from `restart: always`?

<details>
<summary>Answer</summary>

Nothing happens to the other services — each container has its own isolated process space. A crash in one container does not affect any other container. This is one of the core benefits of containerisation: failure is contained.

`restart: unless-stopped` tells Docker to automatically restart the container if it exits with a non-zero code (i.e. crashes), but **not** if you explicitly stopped it with `docker compose stop` or `docker stop`. It also does not restart on Docker daemon restart if the container was manually stopped.

`restart: always` restarts in all cases — including after a manual stop and after the Docker daemon itself restarts (e.g. after a reboot). For local dev `unless-stopped` is the right default: you don't want services auto-starting every time you boot your laptop, but you do want automatic recovery from crashes during a dev session.

</details>

---

**11. Build context and layer caching**

When you run `docker compose build`, Docker sends the contents of `./backend/order-service` to the build daemon and executes the Dockerfile step by step.

What is a layer cache and why does the order of instructions in a Dockerfile matter for rebuild speed? Give an example using the `COPY` and `RUN pip install` steps.

<details>
<summary>Answer</summary>

Each Dockerfile instruction produces a layer. Docker caches layers and reuses them on the next build as long as the instruction and all previous layers are unchanged. As soon as one layer is invalidated (its input changed), Docker rebuilds that layer and every layer after it — cached layers before it are still reused.

This means instruction order determines how much of the cache survives a typical change. If you write:

```dockerfile
COPY . .
RUN pip install -r requirements.txt
```

Any change to any source file invalidates the `COPY` layer, which then invalidates `pip install` — a full dependency reinstall on every code change.

The correct order is:

```dockerfile
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

Now `pip install` is only re-run when `requirements.txt` itself changes. Changing a `.py` file only invalidates the final `COPY` layer, which is cheap. This turns a 60-second rebuild into a 2-second one for the common case of editing source code without changing dependencies.

</details>

---

## What to check in the running system

```bash
# Start everything
docker compose up --build

# Check homepage
open http://localhost:3000

# Check Jaeger for traces
open http://localhost:16686

# Check a /metrics endpoint
curl http://localhost:8001/metrics
```
