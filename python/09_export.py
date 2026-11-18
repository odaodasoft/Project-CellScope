import json, numpy as np, scanpy as sc
from contract import OUT, load_manifest, save_manifest, write_u8, sync_provenance
from sklearn.neighbors import NearestNeighbors

adata = sc.read_h5ad("out/03_clustered.h5ad")
manifest = load_manifest()

# 1. Export Gene Expression Files (D1 & D2)
markers = json.load(open("out/markers.json"))
genes = {m["gene"] for ms in markers["markers"].values() for m in ms}
genes |= set(adata.var_names[:100])  # Add top variable genes
genes = sorted(list(genes))

import os
os.makedirs(f"{OUT}/genes", exist_ok=True)

X = adata.raw[:, genes].X
X = X.toarray() if hasattr(X, "toarray") else np.asarray(X)

gene_index = {}
for i, g in enumerate(genes):
    col = X[:, i]
    nz = col[col > 0]
    hi = float(np.percentile(nz, 99)) if nz.size else 1.0
    scaled = np.clip(col / hi, 0, 1)
    bytes_arr = np.round(scaled * 255).astype(np.uint8)
    
    filename = f"genes/{g}.u8"
    write_u8(filename, bytes_arr)
    gene_index[g] = {"file": filename, "hi": hi}

manifest["genes"] = gene_index

# 2. Compute and Export Uncertainty Score (D5 - Neighbourhood Purity)
Xp = adata.obsm["X_pca"][:, :30]
y = adata.obs["cluster"].cat.codes.to_numpy()
k = 15
idx = NearestNeighbors(n_neighbors=k + 1).fit(Xp).kneighbors(Xp, return_distance=False)
purity = (y[idx[:, 1:]] == y[:, None]).mean(axis=1)
uncertainty = 1.0 - purity

unc_bytes = np.round(uncertainty * 255).astype(np.uint8)
write_u8("obs_uncertainty.u8", unc_bytes)
manifest["obs"]["uncertainty"] = {"file": "obs_uncertainty.u8", "type": "continuous"}

# 3. Save Colorbar LUT (cividis lookup texture for WebGL)
import matplotlib
cm = matplotlib.colormaps["cividis"]
lut = np.round(cm(np.linspace(0, 1, 256)) * 255).astype(np.uint8)
lut.tofile(f"{OUT}/lut_cividis.u8")
manifest["lut"] = "lut_cividis.u8"

save_manifest(manifest)
sync_provenance()
print(f"Exported {len(genes)} genes and uncertainty scores successfully!")


# Pick top 2 marker genes per cluster for the 2D Dot Plot
top_genes = []
for c_id in sorted(markers["markers"].keys(), key=int):
    for m in markers["markers"][c_id][:2]:
        if m["gene"] not in top_genes:
            top_genes.append(m["gene"])

codes = adata.obs["cluster"].cat.codes.to_numpy()
cluster_names = list(adata.obs["cluster"].cat.categories)
C = len(cluster_names)

X_dot = adata.raw[:, top_genes].X
X_dot = X_dot.toarray() if hasattr(X_dot, "toarray") else np.asarray(X_dot)

mean_mat = np.vstack([X_dot[codes == k].mean(axis=0) for k in range(C)])
frac_mat = np.vstack([(X_dot[codes == k] > 0).mean(axis=0) for k in range(C)])

dotplot_data = {
    "clusters": cluster_names,
    "genes": top_genes,
    "mean": np.round(mean_mat, 3).tolist(),
    "frac": np.round(frac_mat, 3).tolist(),
    "maxMean": float(mean_mat.max()) or 1.0
}

with open(f"{OUT}/dotplot.json", "w") as f:
    json.dump(dotplot_data, f, indent=2)

print(f"Exported dotplot.json with {len(top_genes)} genes across {C} clusters.")