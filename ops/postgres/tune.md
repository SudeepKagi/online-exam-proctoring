# PostgreSQL Single-Node Sizing & Tuning Formulas

This document specifies the authoritative mathematical formulas used to size and configure ProctorNet's PostgreSQL instance for single-node deployments across different hardware profiles.

---

## 1. Connection Pool & Process Sizing

### Sizing Rule (Appendix C)
$$\text{Total Application Pools} \le 0.60 \times \text{max\_connections}$$

| Parameter | Formula | 8 vCPU / 16 GB Node (Reference) | 4 vCPU / 8 GB Node | 16 vCPU / 32 GB Node |
| :--- | :--- | :--- | :--- | :--- |
| `max_connections` | $\min(200, \max(50, 12 \times \text{vCPU}))$ | **100** | 50 | 180 |
| `API Workers` | $\min(\text{vCPU} - 2, 4)$ | **4 processes** | 2 processes | 4 processes |
| `API Pool / Process` | $\lfloor 40 / \text{API Workers} \rfloor$ | **10 connections** | 15 connections | 10 connections |
| `Background Workers` | $1 \text{ to } 2$ | **2 processes** | 1 process | 2 processes |
| `Worker Pool / Process`| $10$ | **10 connections** | 10 connections | 10 connections |
| **Total Max Active** | $(\text{API} \times 10) + (\text{Workers} \times 10)$ | **60 connections (60%)** | 40 connections (80%) | 60 connections (33%) |

---

## 2. Memory & Buffer Allocation Formulas

### `shared_buffers`
- **Formula:** $25\%$ of total system RAM (capped at $8\text{ GB}$ on Windows / $16\text{ GB}$ on Linux).
- **16 GB RAM:** $4\text{ GB}$
- **32 GB RAM:** $8\text{ GB}$
- **8 GB RAM:** $2\text{ GB}$

### `effective_cache_size`
- **Formula:** $75\%$ of total system RAM (informs query planner of available OS page cache).
- **16 GB RAM:** $12\text{ GB}$
- **32 GB RAM:** $24\text{ GB}$
- **8 GB RAM:** $6\text{ GB}$

### `work_mem`
- **Formula:** $\frac{\text{Available Work RAM}}{\text{max\_connections} \times 2}$ where $\text{Available Work RAM} \approx 25\% \text{ RAM}$.
$$\text{work\_mem} = \frac{0.25 \times \text{Total RAM}}{\text{max\_connections} \times 2}$$
- **16 GB RAM, 100 conns:** $\frac{4096\text{ MB}}{200} \approx 20\text{ MB} \to \mathbf{32\text{ MB}}$
- **8 GB RAM, 50 conns:** $\frac{2048\text{ MB}}{100} \approx \mathbf{20\text{ MB}}$

### `maintenance_work_mem`
- **Formula:** $\min(2\text{ GB}, \max(256\text{ MB}, 0.05 \times \text{Total RAM}))$.
- **16 GB RAM:** $\mathbf{1\text{ GB}}$
- **32 GB RAM:** $\mathbf{2\text{ GB}}$
- **8 GB RAM:** $\mathbf{512\text{ MB}}$

---

## 3. Storage & Planner Costs (NVMe SSD)

```ini
random_page_cost = 1.1          # Fast NVMe random read latency compared to sequential
seq_page_cost = 1.0
effective_io_concurrency = 200  # NVMe drive controller concurrent queue depth
```

---

## 4. Hot Table Autovacuum & Fillfactor Configuration

For tables subject to frequent revision updates (`answers`, `exam_attempts`):
- `fillfactor = 80`: Reserves 20% free space in each 8KB heap page for Heap-Only-Tuple (HOT) updates, eliminating index write churn when candidate answers or revisions update.
- `autovacuum_vacuum_scale_factor = 0.02`: Triggers background vacuum when 2% of table tuples are updated/dead.
- `autovacuum_analyze_scale_factor = 0.02`: Refreshes query planner statistics after 2% modification.
