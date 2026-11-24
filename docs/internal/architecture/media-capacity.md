# LiveKit SFU Media Capacity & Bandwidth Math (ADR-008 / Notion 13.10)

## 1. Architectural Scaling Rationale

In legacy WebRTC mesh architectures, bandwidth and decode loads grow quadratically:
- **Mesh Ingress / Egress**: Every candidate transmits to every invigilator: $\mathcal{O}(N \times M)$.
- **Invigilator Decode Load**: An invigilator viewing $N$ candidates must decode $2N$ streams (webcam + screen). At $N = 50$, browser CPU saturates, dropping frames and crashing tab processes.

With **LiveKit Selective Forwarding Unit (SFU)**:
- **Candidate Upstream**: Exactly **1 stream** uploaded to the SFU regardless of the number of viewers: $\mathcal{O}(1)$.
- **Invigilator Downstream (Selective Subscription)**: Strictly driven by **visible viewport tiles**: $\mathcal{O}(\text{visible})$. Invigilators subscribe selectively only to active tiles; off-page tiles are unsubscribed.
- **Zero-Transcoding Forwarding**: The SFU acts purely as an RTP packet router (packet forwarding in kernel UDP buffers), not a transcoder.

---

## 2. Capacity Model & Formulas

### 2.1 Candidate Stream Profile (Per Candidate)
- **Screen Share (VP8 Simulcast)**:
  - *High Layer*: 1280 × 720 @ 5 fps, capped at 400 kbps (0.4 Mbps), `contentHint: 'detail'`.
  - *Low Layer*: 640 × 360 @ 3 fps, capped at 120 kbps (0.12 Mbps).
- **Webcam (VP8, Non-simulcast, if enabled)**:
  - 320 × 180 @ 15 fps, capped at 150 kbps (0.15 Mbps), `contentHint: 'motion'`.
- **Audio**: Disabled by default (0 kbps).

### 2.2 SFU Network Ingress Math
$$\text{Ingress Bandwidth} \approx N \times (R_{\text{screen}} + R_{\text{cam}})$$

- Ingress to SFU at 500 candidates: 500 × (0.4 Mbps screen + 0.15 Mbps camera) ≈ **275 Mbps**.
- Egress from SFU per invigilator: 12 visible tiles × 0.1 Mbps + 1 focus stream @ 0.5 Mbps ≈ **1.7 - 2.0 Mbps**.

| Candidate Count ($N$) | Screen Bandwidth | Camera Bandwidth | Total Ingress Bandwidth | Minimum Network Interface |
|---|---|---|---|---|
| **100 candidates** | $40\text{ Mbps}$ | $15\text{ Mbps}$ | **$55\text{ Mbps}$** | $1\text{ Gbps}$ NIC |
| **500 candidates** | $200\text{ Mbps}$ | $75\text{ Mbps}$ | **$275\text{ Mbps}$** (275 Mbps) | $1\text{ Gbps}$ / $2.5\text{ Gbps}$ NIC |
| **1,000 candidates**| $400\text{ Mbps}$ | $150\text{ Mbps}$ | **$550\text{ Mbps}$** | $2.5\text{ Gbps}$ / $5\text{ Gbps}$ NIC |
| **2,500 candidates**| $1,000\text{ Mbps}$ | $375\text{ Mbps}$ | **$1.375\text{ Gbps}$** | $10\text{ Gbps}$ NIC (AWS c6i.2xlarge+) |

> [!IMPORTANT]
> **EC2 Bandwidth Baseline vs Burst**: When choosing AWS EC2 instances for LiveKit, ensure the **baseline** network bandwidth (not burst) exceeds peak ingress. For 500 students (275 Mbps), `c6i.xlarge` (up to $12.5\text{ Gbps}$ burst, $1.25\text{ Gbps}$ baseline) provides ample headroom.

### 2.3 SFU Network Egress Math
Egress is driven solely by what staff actively watch, not by total candidates $N$:
$$\text{Egress Bandwidth per Invigilator} \approx (T_{\text{visible}} \times R_{\text{low}}) + (T_{\text{focus}} \times R_{\text{high}})$$

Where:
- $T_{\text{visible}} = 12$ tiles per page (default).
- $R_{\text{low}} \approx 100\text{ kbps}$ ($0.1\text{ Mbps}$).
- $T_{\text{focus}} = 1$ candidate promoted to focus ($R_{\text{high}} \approx 500\text{ kbps} = 0.5\text{ Mbps}$).

$$\text{Egress per Invigilator} \approx (12 \times 0.1\text{ Mbps}) + (1 \times 0.5\text{ Mbps}) \approx \mathbf{1.7\text{ Mbps} - 2.0\text{ Mbps}}$$

Even with 50 concurrent invigilators monitoring a 2,500-student university-wide exam:
$$\text{Total Egress} = 50 \times 2.0\text{ Mbps} = \mathbf{100\text{ Mbps}}$$
*Egress is less than 8% of ingress.*

---

## 3. Invigilator Browser Decode Footprint

- **Streams Decoded**: Exactly 12 low-resolution thumbnail video streams ($640 \times 360$ @ 3 fps) + 1 focus stream.
- **Hardware Acceleration**: VP8 hardware decoding in Chromium requires $< 8\%$ CPU across modern dual-core laptop processors.
- **Off-Screen Unsubscription**: When an invigilator navigates from Page 1 to Page 2, Page 1 streams are unsubscribed (`publication.setSubscribed(false)`). The browser decodes only the active page.

---

## 4. Single-Node Capacity Limits

LiveKit SFU CPU usage is bound by UDP packet forwarding:
1. **Packet Rate at 500 Candidates**:
   - $\approx 275\text{ Mbps} \div (1200\text{ bytes per packet} \times 8) \approx 28,600\text{ packets/second}$.
2. **CPU Forwarding**:
   - Modern Linux kernel `SO_REUSEPORT` with Go runtime forwards up to $350,000\text{ packets/second}$ on 4 vCPUs.
   - Forwarding 500 streams consumes $< 15\%$ CPU on a 4-core node.
3. **Bottleneck**: Network interface bandwidth (NIC) and UDP buffer drops, **never CPU**.
