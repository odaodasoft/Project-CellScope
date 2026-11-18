# Design Decision Log — Lab 3

## D1 — Gene Expression Loading Strategy (Requirement R2)
- **Task(s) served:** T2 (locate gene expression)
- **Choice:** Individual binary files per gene (`genes/<symbol>.u8`) loaded on demand via a `genes.json` index.
- **Why:** Keeps initial page load light and scales to thousands of genes without forcing the browser to parse massive multi-megabyte payloads upfront.
- **How I checked it:** Verified via browser network tab that gene binary files load on demand within <50ms.

## D2 — Expression Scaling Method (Requirement R2)
- **Task(s) served:** T2, T5
- **Choice:** Percentile clip at the 99th percentile ($p_{99}$) of non-zero values (`v = min(x / p99, 1)`).
- **Why:** Single-cell RNA sequencing data has extreme outliers. A per-gene maximum compresses all standard cells into dark bins, whereas $p_{99}$ clipping preserves visual contrast across expressing cells while documenting saturation in the legend.
- **How I checked it:** Inspected histograms of high-variance genes; confirmed the legend explicitly indicates clipping thresholds.

## D3 — Channel for Gene Expression in 3D View (Requirement R2)
- **Task(s) served:** T2 (locate), T5 (compare)
- **Choice:** Sequential colormap lookup texture (`cividis`) implemented via a shared 1D texture in the fragment shader.
- **Why:** `cividis` is perceptually uniform and specifically designed to be color-vision-deficiency safe. Using a lookup texture guarantees Python legends and WebGL shaders use identical color mappings. Position is reserved for spatial embedding, and size/luminance reduce readability.
- **How I checked it:** Tested with Chrome DevTools deuteranopia simulation and peer verification.

## D5 — Uncertainty Metric and Encoding (Requirement R4)
- **Task(s) served:** T9 (locate uncertainty)
- **Choice:** Neighbourhood purity ($k=15$ in PCA space) encoded via point desaturation/fading toward neutral grey.
- **Why:** Neighbourhood purity is non-parametric, easy to interpret locally without model assumptions, and desaturation allows uncertain cells to flag themselves while keeping overarching cluster boundaries readable.
- **How I checked it:** Visually inspected boundary regions between adjacent cell types to verify high uncertainty scores cluster tightly at transition zones.

## D6 — Linked 2D View (Requirement R5)
- **Task(s) served:** T4, T5 (compare expression across clusters)
- **Choice:** Dot plot implemented via SVG, showing mean expression (color intensity) and fraction expressing (dot radius).
- **Why:** Encodes two quantitative attributes simultaneously per cell group, serving comparison tasks far better than a 3D point cloud where marks occlude one another.
- **How I checked it:** Verified that an observer can identify marker genes distinguishing clusters within 15 seconds.

## D8 — Accessibility Measures (Requirement R6)
- **Choice 1 (CVD):** Shader-based Deuteranopia simulation toggle using the Machado et al. matrix. Checked via visual inspection.
- **Choice 2 (Keyboard Nav):** All dropdowns and buttons are focusable via `Tab` with visible focus rings, enabling complete navigation without a mouse. Checked via manual keyboard-only walkthrough.
- **Choice 3 (Text Alternative):** SVG dot plot and container include semantic `aria-label` attributes for screen reader support. Checked via DOM inspection.