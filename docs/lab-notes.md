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