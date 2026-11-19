# Lab Notes — Task Abstractions (Requirement R1)

### Task 1 (T2 — Locate)
* **Domain Question:** "Where are the cytotoxic T cells expressing `CD8A` in the cellular landscape?"
* **Action:** Locate (search unknown location for a known target attribute)
* **Target:** Extremes of one quantitative attribute (`CD8A` log-normalised expression)
* **Data Involved:** Per-cell gene expression values mapped against 3D PCA coordinates
* **Target View:** 3D point cloud rendered with a sequential colormap (`cividis`) and a real-units continuous legend.

### Task 2 (T4 — Compare)
* **Domain Question:** "Which marker genes distinguish cluster 3 from cluster 5?"
* **Action:** Compare (query dependencies between attributes across groups)
* **Target:** Dependency between gene expression and cluster identity (gene × cluster)
* **Data Involved:** Aggregated mean expression and detection fraction per cluster
* **Target View:** Linked 2D Dot Plot showing mean expression via color intensity and fraction expressing via dot area.

### Task 3 (T9 — Derive & Locate)
* **Domain Question:** "Which cells are situated in ambiguous boundary regions where we are most unsure of their cluster assignment?"
* **Action:** Derive → Locate (compute a new metric, then search for its extremes)
* **Target:** Extremes of a derived attribute (neighbourhood purity uncertainty score)
* **Data Involved:** Per-cell structural uncertainty score derived from PCA k-NN graphs
* **Target View:** 3D point cloud with uncertainty mapped to point desaturation/fading toward neutral grey, preserving structural cluster context.

## R7 — Peer Test Log

* **Participant:** Mihnea Ciubotariu
* **Date:** 2026-11-19
* **Setup:** Observed silently while participant solved the three abstracted tasks phrased as domain questions (no UI hints given).

| Task | Domain Prompt Given | Time Taken | Errors / Hesitations | Observation & Fix Applied |
| :--- | :--- | :--- | :--- | :--- |
| **Task 1 (T2)** | *"Where are the cytotoxic T cells expressing CD8A?"* | 16 s | Briefly hovered over clusters first before noticing the Color Mode dropdown. | Switched Color Mode to Gene, selected `CD8A`, and immediately located the bright yellow high-expression pocket in 3D. |
| **Task 2 (T4)** | *"Which marker genes distinguish cluster 3 from cluster 5?"* | 22 s | None — opened the 2D Dot Plot button right away. | Scanned columns `C3` and `C5` side-by-side and identified high-fraction/high-mean marker rows without occlusion errors. |
| **Task 3 (T9)** | *"Which cells are in ambiguous boundary regions where cluster assignment is most uncertain?"* | 19 s | Paused for a couple of seconds to read what the greyed-out points represented. | Added an explicit explanatory note in the Uncertainty legend explaining that higher $1 - \text{k-NN purity}$ desaturates points toward grey while preserving cluster hue. |

* **Takeaway fed back into design:** All three tasks were completed in under 25 seconds without wrong answers. The main friction point was interpreting what desaturation meant in Uncertainty mode, which was resolved by adding a plain-language explanation directly inside `#legend`.