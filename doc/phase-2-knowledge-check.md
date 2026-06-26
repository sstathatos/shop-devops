# Phase 2 Knowledge Check — Helm Charts

> Covers Helm chart structure, Kubernetes resource concepts, and local chart validation.
> All questions are scoped to what exists in `helm/` right now — no live cluster required for the conceptual questions.

---

## Questions

**Q1.** Walk through what happens in a multi-stage Docker build (e.g. `backend/user-service/Dockerfile`). Why does the final image not contain pip, build tools, or the requirements cache? What does that mean for image size and attack surface?

<details>
<summary>Answer</summary>

A multi-stage build uses multiple `FROM` instructions in one Dockerfile. The first stage (the **builder**) installs all build-time dependencies — pip, compilers, dev headers — and produces the compiled/installed output. The final `production` stage starts from a clean, minimal base image (e.g. `python:3.12-slim`) and copies only the installed packages from the builder using `COPY --from=builder`.

The production image never contains pip, wheel caches, or build tools because they were never installed into it — only the compiled artifacts are copied across. This shrinks the image (often by 200–400 MB for Python services) and reduces attack surface: there is no package manager for an attacker to abuse if they get a shell inside the container.

In this project a third `dev` stage sits between builder and production. It inherits from `builder` (so pip and all packages are present), mounts the source code as a volume via `docker-compose.yml`, and runs uvicorn with `--reload` for hot-reload. The `docker-compose.yml` uses `target: dev`; CI and Helm use no `target`, so Docker defaults to the last stage (`production`).

</details>

---

**Q2.** Open `helm/charts/user-service/templates/deployment.yaml`. It sets both `resources.requests` and `resources.limits`. What is the difference? What happens when a container exceeds its **memory** limit? What about its **CPU** limit? Are those two outcomes the same?

<details>
<summary>Answer</summary>

- **`requests`** — the amount the scheduler uses to decide which node can fit the pod. A pod is only placed on a node that has at least this much free.
- **`limits`** — the hard ceiling enforced at runtime by the Linux kernel cgroups.

The outcomes differ:

- **Memory over limit** → the kernel OOM-kills the container immediately. The pod restarts (subject to `restartPolicy`). This is hard and immediate.
- **CPU over limit** → the kernel **throttles** the container — it doesn't get more CPU time than its limit allows, but it is not killed. The process slows down but keeps running.

So OOMKilled = restart; CPU throttle = slowness. They are not the same.

</details>

---

**Q3.** `helm/charts/user-service/templates/hpa.yaml` defines `minReplicas: 2, maxReplicas: 5, targetCPUUtilizationPercentage: 70`. Describe the sequence of events from a sudden traffic spike to a new pod being ready to serve requests. What is the default scale-down stabilization window, and why does it exist?

<details>
<summary>Answer</summary>

1. Traffic arrives → CPU utilization across existing pods rises above 70%.
2. The HPA controller (running in the control plane) polls metrics every 15 s by default and calculates `desiredReplicas = ceil(currentReplicas × currentUtilization / targetUtilization)`.
3. HPA updates the `Deployment`'s replica count.
4. The Deployment controller creates a new `ReplicaSet` pod spec and the scheduler assigns it to a node.
5. The kubelet on that node pulls the image (or uses cache), starts the container, and runs the `readinessProbe` on `/health`.
6. Once the probe passes, the pod is added to the Service's Endpoints and starts receiving traffic.

The default **scale-down stabilization window is 5 minutes**. Without it, a brief traffic drop would immediately shrink the pod count and then a recovery spike would need to scale back up — causing flapping and unnecessary churn. The window ensures the HPA waits until utilization has been consistently low before reducing replicas.

</details>

---

**Q4.** `helm/charts/user-service/templates/pdb.yaml` sets `minAvailable: 1`. What is a PodDisruptionBudget and when does it activate? Give a concrete scenario where, without it, you could lose all replicas during a node drain.

<details>
<summary>Answer</summary>

A **PodDisruptionBudget** tells Kubernetes the minimum number (or percentage) of pods of a given selector that must remain available during **voluntary disruptions** — cluster upgrades, node drains (`kubectl drain`), or node maintenance.

Scenario without PDB: `user-service` runs 2 replicas, both scheduled on the same node. An operator drains that node for maintenance. Kubernetes evicts both pods simultaneously. For several seconds (until they reschedule) `user-service` is completely unavailable — 503s across the platform.

With `minAvailable: 1`, the drain process evicts one pod, waits until a replacement is running and ready elsewhere, then evicts the second. There is always at least one healthy pod serving traffic.

PDBs only apply to voluntary disruptions. A node crash (involuntary) bypasses the PDB.

</details>

---

**Q5.** `helm/charts/user-service/templates/servicemonitor.yaml` defines a `ServiceMonitor` CRD. What problem does it solve? Why does Prometheus Operator need it instead of you editing a static `prometheus.yml` scrape config directly?

<details>
<summary>Answer</summary>

In a static `prometheus.yml`, every scrape target is hardcoded. Adding a new service means editing the config and reloading Prometheus — a manual, error-prone step that doesn't scale in a dynamic cluster.

**Prometheus Operator** watches for `ServiceMonitor` CRDs and automatically generates and reloads scrape configs whenever a `ServiceMonitor` is created, updated, or deleted. Each Helm chart ships its own `ServiceMonitor` alongside its `Service` — deploying the chart is enough to get Prometheus scraping it.

The `ServiceMonitor` references `user-service` via a label selector (`app.kubernetes.io/name: user-service`), so Prometheus dynamically discovers all pods behind that Service. No central prometheus.yml edit needed.

</details>

---

**Q6.** Look at `helm/shop-app/Chart.yaml`. The umbrella chart lists all six service charts as `file://` dependencies. What command must you run before `helm install shop-app` to pull in those sub-charts? What file does Helm write to track their resolved versions?

<details>
<summary>Answer</summary>

```bash
helm dependency update ./helm/shop-app
```

This reads `Chart.yaml`, resolves each dependency from its `repository` URL (in this case local `file://` paths), packages each sub-chart as a `.tgz`, and places them in `helm/shop-app/charts/`.

Helm writes `helm/shop-app/Chart.lock` — a lockfile containing the exact version and digest of each resolved dependency. Similar to `package-lock.json` in npm, it guarantees reproducible installs. You should commit `Chart.lock` to git but not the `charts/` directory.

</details>

---

**Q7.** The `helm/shop-app/values.yaml` has this block:

```yaml
user-service:
  image:
    tag: v1.2.0
```

But `helm/charts/user-service/values.yaml` has `tag: latest`. Which value wins? What is the full precedence order when you also pass `--set user-service.image.tag=v1.3.0` at install time?

<details>
<summary>Answer</summary>

Helm merges values in this order (later wins):

1. Sub-chart's own `values.yaml` — the defaults (`latest`)
2. Umbrella chart's `values.yaml` scoped under the sub-chart key (`v1.2.0` wins over `latest`)
3. `--set` and `-f` flags at install/upgrade time (`v1.3.0` wins over everything)

So the effective tag becomes `v1.3.0`. Fields not mentioned at a higher level fall through from the sub-chart defaults unchanged.

</details>

---

**Q8.** The `helm/charts/user-service/templates/deployment.yaml` omits `replicas:` from the `spec` when `autoscaling.enabled` is true. Why? What would happen if you kept `replicas: 1` in the Deployment while the HPA is also active?

<details>
<summary>Answer</summary>

The HPA owns the replica count. It reads the current count from the Deployment and writes its desired count back to it.

If you hardcode `replicas: 1` in the Deployment manifest and the HPA scales up to 3, the next `helm upgrade` would reset the Deployment to `replicas: 1`, overriding the HPA's decision and terminating 2 pods. The HPA would then scale back up — a cycle of churn on every deploy.

The fix is to omit `replicas` from the Deployment spec when HPA is enabled (as done here via `{{- if not .Values.autoscaling.enabled }}`), so Helm never touches that field and the HPA has exclusive control.

</details>

---

**Q9.** `helm/charts/user-service/templates/secret.yaml` uses `stringData:` instead of `data:`. What is the difference? Why does using `data:` with a plaintext value cause a problem?

<details>
<summary>Answer</summary>

- **`data:`** — expects values to be **base64-encoded**. If you put a plaintext password here, Kubernetes decodes it as base64 and gives the container a garbled string.
- **`stringData:`** — accepts plaintext strings. Kubernetes encodes them to base64 internally before storing. What you write is what the pod receives as an env var.

In a Helm chart, `stringData` is the right choice because the values come from `values.yaml` (or `--set`) as plain strings. You don't want to force users to pre-encode their secrets before passing them to Helm.

Note: `kubectl get secret -o yaml` will always show the `data:` field (base64), not `stringData:` — that's expected.

</details>

---

**Q10.** A new developer runs this directly on the cluster:

```bash
helm upgrade --set image.tag=v9.9.9 user-service ./helm/charts/user-service
```

It works. Why is this a problem in a GitOps setup?

<details>
<summary>Answer</summary>

In GitOps, git is the single source of truth. ArgoCD continuously compares the cluster state to what is in git and reconciles any drift.

The developer's manual `helm upgrade` creates **cluster drift** — the running version (`v9.9.9`) is not in git. The next time ArgoCD syncs (automatically, or on the next git push), it overwrites the manual change and reverts to whatever tag is in the git-tracked values file. The developer's change is silently lost.

Beyond that: there is no audit trail (no PR, no review, no rollback via `git revert`), no CI gate (image may not have passed tests or security scans), and other team members have no visibility into what changed or why.

</details>

---

## Local Validation with `helm` CLI

These commands let you validate all charts **without a cluster**. Install helm first if needed:

```bash
# Install helm (Linux)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Or with apt
sudo apt-get install helm
```

### Lint a single chart

```bash
helm lint helm/charts/user-service
helm lint helm/charts/order-service
helm lint helm/charts/notification-service
helm lint helm/charts/api-gateway
helm lint helm/charts/product-service
helm lint helm/charts/frontend
```

Lint checks: required Chart.yaml fields, template syntax, values schema. A clean run outputs `1 chart(s) linted, 0 chart(s) failed`.

### Lint all charts at once

```bash
for chart in helm/charts/*/; do echo "=== $chart ==="; helm lint "$chart"; done
```

### Render templates locally (no cluster needed)

```bash
# See all YAML that would be applied for user-service
helm template shop-user-service helm/charts/user-service

# Override values like you would at install time
helm template shop-user-service helm/charts/user-service \
  --set image.tag=v1.2.0 \
  --set autoscaling.enabled=true

# Render just one template
helm template shop-user-service helm/charts/user-service \
  --show-only templates/deployment.yaml
```

### Resolve umbrella chart dependencies

```bash
# Pull all sub-charts into helm/shop-app/charts/
helm dependency update helm/shop-app

# Then render the full umbrella (all 6 services)
helm template shop-app helm/shop-app
```