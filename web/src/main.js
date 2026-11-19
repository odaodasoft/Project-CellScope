import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { projectByHand } from './experiments.js';
import { loadManifest, loadF32, loadU8, loadJSON } from './data.js';
import vertexShader from './shaders/points.vert.glsl?raw';
import fragmentShader from './shaders/points.frag.glsl?raw';

// ---- renderer, scene, camera ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);
 
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);
 
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0, 3);
 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
 
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
 
window.cs = { THREE, renderer, scene, camera, controls };
 
// ---- CONTENT START ----
const hex = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
const PALETTE = [0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2, 0x59a14f, 0xedc948,
                 0xb07aa1, 0xff9da7, 0x9c755f, 0xbab0ac, 0x1b9e77, 0x7570b3].map(hex);
 
const uniforms = {
  uWorldSize: { value: 0.03 },
  uPxPerUnit: { value: 1.0 },
  uHighlight: { value: -1.0 },
  uPalette:   { value: PALETTE },
  uMode:      { value: 0.0 }, // 0.0 = cluster, 1.0 = uncertainty, 2.0 = gene
  uCvd:       { value: 0.0 }, // 0.0 = normal, 1.0 = simulation active
  uLut:       { value: null } // will hold our Cividis texture
};
 
function updatePointScale() {
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  uniforms.uPxPerUnit.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', updatePointScale);
updatePointScale();
 
let currentMesh = null;
let renderMode = 'points';
let currentEmbeddingKey = 'pca';
let material = null, manifest = null, clusterCodes = null, markers = null;
 
// ---- Initialization: Load Manifest, LUT, and Populate Dropdowns ----
async function initApp() {
  manifest = await loadManifest();
  if (!markers) markers = await loadJSON('/data/' + manifest.markers);
  populateGeneDropdown();

  const lutBytes = await loadU8('/data/' + manifest.lut);
  const lutTex = new THREE.DataTexture(lutBytes, 256, 1, THREE.RGBAFormat);
  lutTex.needsUpdate = true;
  uniforms.uLut.value = lutTex;

  await loadCells('pca');
}

async function loadCells(embeddingKey = 'pca') {
  currentEmbeddingKey = embeddingKey;
  const embMeta = manifest.embeddings[embeddingKey];
  
  const positions = await loadF32('/data/' + embMeta.file);
  const clusterFile = embMeta.synthetic ? embMeta.cluster_file : manifest.obs.cluster.file;
  clusterCodes = await loadU8('/data/' + clusterFile);
 
  const n_cells = embMeta.n_cells || manifest.n_cells;

  if (positions.length !== n_cells * 3) throw new Error('positions: size mismatch');
  if (clusterCodes.length !== n_cells) throw new Error('cluster codes: size mismatch');

  if (currentMesh) {
    scene.remove(currentMesh);
    if (currentMesh.geometry) currentMesh.geometry.dispose();
    currentMesh = null;
  }

  if (renderMode === 'points') {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aCluster', new THREE.BufferAttribute(clusterCodes, 1));

    material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    currentMesh = new THREE.Points(geometry, material);
    scene.add(currentMesh);
    window.cs.points = currentMesh;
  } else {
    // Smooth spheres with professional lighting response
    const sphereGeo = new THREE.SphereGeometry(0.015, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({ 
      roughness: 0.3, 
      metalness: 0.1 
    });
    
    currentMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, n_cells);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const posVector = new THREE.Vector3();

    for (let i = 0; i < n_cells; i++) {
      posVector.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      matrix.makeTranslation(posVector);
      currentMesh.setMatrixAt(i, matrix);

      const code = Math.min(clusterCodes[i], PALETTE.length - 1);
      const p = PALETTE[code];
      color.setRGB(p.x, p.y, p.z, THREE.SRGBColorSpace);
      currentMesh.setColorAt(i, color);
    }
    currentMesh.instanceMatrix.needsUpdate = true;
    if (currentMesh.instanceColor) currentMesh.instanceColor.needsUpdate = true;

    scene.add(currentMesh);
    window.cs.points = currentMesh;
  }

  const tag = embMeta.synthetic ? 'SYNTHETIC' : 'PCA';
  hudInfo = `${n_cells.toLocaleString()} cells · ${tag} · ${renderMode.toUpperCase()}`;
  updateLegend(); // <-- Spot 1: refreshes legend after loading cells
}
 
initApp().catch((err) => { console.error(err); hud.textContent = String(err); });
function update(dt) { /* nothing to animate yet */ }

const tooltip = document.getElementById('tooltip');
 
function describeCell(i) {
  const label = manifest.obs.cluster.categories[clusterCodes[i]];
  const top = markers.markers[label].slice(0, 3).map((m) => m.gene).join(', ');
  return `cell ${i}<br>cluster ${label}<br>top markers: ${top}`;
}
 
function showTooltip(i, x, y) {
  if (i < 0) { tooltip.style.display = 'none'; uniforms.uHighlight.value = -1; return; }
  tooltip.innerHTML = describeCell(i);
  tooltip.style.left = x + 14 + 'px';
  tooltip.style.top = y + 14 + 'px';
  tooltip.style.display = 'block';
  uniforms.uHighlight.value = clusterCodes[i];
}

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.015;
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!currentMesh) return;
  
  pointer.set(
    (e.clientX / window.innerWidth) * 2 - 1, 
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentMesh);

  if (hits.length > 0) {
    const cellIndex = (renderMode === 'spheres') ? hits[0].instanceId : hits[0].index;
    if (cellIndex !== undefined) {
      showTooltip(cellIndex, e.clientX, e.clientY);
    } else {
      showTooltip(-1, 0, 0);
    }
  } else {
    showTooltip(-1, 0, 0);
  }
});

function populateGeneDropdown() {
  const select = document.getElementById('geneSelect');
  if (!manifest || !manifest.genes) return;
  select.innerHTML = Object.keys(manifest.genes).map(g => `<option value="${g}">${g}</option>`).join('');
}

// ---- UI Event Listeners ----
document.getElementById('colorModeSelect').addEventListener('change', async (e) => {
  const mode = e.target.value;
  const geneSelect = document.getElementById('geneSelect');
  geneSelect.style.display = (mode === 'gene') ? 'inline-block' : 'none';

  if (!currentMesh) return;

  if (mode === 'cluster') {
    uniforms.uMode.value = 0.0;
  } else if (mode === 'uncertainty') {
    uniforms.uMode.value = 1.0;
    const uncBuffer = await loadU8('/data/' + manifest.obs.uncertainty.file);
    currentMesh.geometry.setAttribute('aValue', new THREE.BufferAttribute(uncBuffer, 1, true));
  } else if (mode === 'gene') {
    geneSelect.dispatchEvent(new Event('change'));
  }
  updateLegend(); // <-- Spot 2: refreshes legend when switching color mode
});

document.getElementById('geneSelect').addEventListener('change', async (e) => {
  const gene = e.target.value;
  if (!manifest || !manifest.genes[gene] || !currentMesh) return;

  const geneMeta = manifest.genes[gene];
  const geneBuffer = await loadU8('/data/' + geneMeta.file);
  
  uniforms.uMode.value = 2.0;
  currentMesh.geometry.setAttribute('aValue', new THREE.BufferAttribute(geneBuffer, 1, true));
  updateLegend(); // <-- Spot 3: refreshes legend when picking a gene
});

document.getElementById('cvdToggle').addEventListener('change', (e) => {
  uniforms.uCvd.value = e.target.checked ? 1.0 : 0.0;
});

document.getElementById('sizeSlider').addEventListener('input', (e) => {
  uniforms.uWorldSize.value = parseFloat(e.target.value);
});

document.getElementById('datasetSelect').addEventListener('change', (e) => {
  loadCells(e.target.value).catch(console.error);
});

document.getElementById('modeToggle').addEventListener('click', (e) => {
  renderMode = renderMode === 'points' ? 'spheres' : 'points';
  e.target.textContent = renderMode === 'points' ? 'Switch to Spheres' : 'Switch to Points';
  loadCells(currentEmbeddingKey).catch(console.error);
});

window.cs.projectByHand = projectByHand;

// ---- HUD and render loop ----
const hud = document.getElementById('hud');
const hudText = document.getElementById('hud-text');
let hudInfo = '';
let frames = 0, last = performance.now(), prev = last;
 
function animate(now) {
  requestAnimationFrame(animate);
  update((now - prev) / 1000);
  prev = now;
  controls.update();
  renderer.render(scene, camera);
 
  frames++;
  if (now - last > 500) {
    const fps = Math.round(frames * 1000 / (now - last));
    const r = renderer.info.render;
    hudText.textContent = `${hudInfo} · ${r.calls} calls · ${r.points || r.geometries || 0} pts · ${r.triangles} tris · ${fps} FPS`;
    frames = 0; last = now;
  }
}
requestAnimationFrame(animate);

document.getElementById('toggleDotPlot').addEventListener('click', () => {
  const panel = document.getElementById('dotplotPanel');
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) renderDotPlot();
});

document.getElementById('closeDotPlot').addEventListener('click', () => {
  document.getElementById('dotplotPanel').style.display = 'none';
});

async function renderDotPlot() {
  const container = document.getElementById('dotplotContainer');
  if (container.innerHTML !== '') return; // Already rendered

  const res = await fetch('/data/dotplot.json');
  const data = await res.json();
  const lut = await loadU8('/data/lut_cividis.u8');

  const { clusters, genes, mean, frac, maxMean } = data;
  const cellW = 28;
  const cellH = 22;
  const padLeft = 75;
  const padTop = 35;
  const width = padLeft + clusters.length * cellW + 10;
  const height = padTop + genes.length * cellH + 10;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Dot plot showing mean expression and fraction expressing for marker genes across clusters');

  // Column headers (Clusters) — clicking highlights cluster in 3D
  clusters.forEach((cName, ci) => {
    const x = padLeft + ci * cellW + cellW / 2;
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', padTop - 10);
    text.setAttribute('fill', '#ddd');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.style.cursor = 'pointer';
    text.textContent = `C${cName}`;
    text.addEventListener('click', () => {
      uniforms.uHighlight.value = (uniforms.uHighlight.value === ci) ? -1.0 : ci;
      updateLegend(); // <-- Spot 4a: updates highlight state in legend
    });
    svg.appendChild(text);
  });

  // Rows (Genes) & Dots
  genes.forEach((gene, gi) => {
    const y = padTop + gi * cellH + cellH / 2;

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', padLeft - 8);
    label.setAttribute('y', y + 4);
    label.setAttribute('fill', '#ddd');
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '11');
    label.style.cursor = 'pointer';
    label.textContent = gene;
    label.addEventListener('click', () => {
      const modeSelect = document.getElementById('colorModeSelect');
      const geneSelect = document.getElementById('geneSelect');
      if (manifest && manifest.genes[gene]) {
        modeSelect.value = 'gene';
        geneSelect.style.display = 'inline-block';
        geneSelect.value = gene;
        geneSelect.dispatchEvent(new Event('change'));
      }
    });
    svg.appendChild(label);

    clusters.forEach((cName, ci) => {
      const x = padLeft + ci * cellW + cellW / 2;
      const f = frac[ci][gi];
      const m = mean[ci][gi];

      const maxR = (Math.min(cellW, cellH) / 2) - 2;
      const r = maxR * Math.sqrt(f);

      const lutIdx = Math.min(255, Math.round((m / maxMean) * 255));
      const color = `rgb(${lut[4 * lutIdx]}, ${lut[4 * lutIdx + 1]}, ${lut[4 * lutIdx + 2]})`;

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', Math.max(1.5, r));
      circle.setAttribute('fill', color);
      circle.style.cursor = 'pointer';

      const title = document.createElementNS(NS, 'title');
      title.textContent = `Cluster ${cName} · ${gene}: ${(f * 100).toFixed(0)}% expressing, mean ${m.toFixed(2)}`;
      circle.appendChild(title);

      circle.addEventListener('click', () => {
        uniforms.uHighlight.value = (uniforms.uHighlight.value === ci) ? -1.0 : ci;
        updateLegend(); // <-- Spot 4b: updates highlight state in legend
      });

      svg.appendChild(circle);
    });
  });

  container.appendChild(svg);
}

function getClusterCount(clusterId) {
  if (!clusterCodes) return 0;
  let count = 0;
  for (let i = 0; i < clusterCodes.length; i++) {
    if (clusterCodes[i] === clusterId) count++;
  }
  return count;
}

function inferCellTypeLabel(clusterName, topMarkers = []) {
  const markersSet = new Set(topMarkers.map((m) => m.gene));
  if (markersSet.has('CD8A') || markersSet.has('CD8B')) return 'CD8 T cells';
  if (markersSet.has('IL7R')) return 'CD4 T cells';
  if (markersSet.has('MS4A1')) return 'B cells';
  if (markersSet.has('CD14') || markersSet.has('LYZ')) return 'CD14+ monocytes';
  if (markersSet.has('FCGR3A') || markersSet.has('MS4A7')) return 'FCGR3A+ monocytes';
  if (markersSet.has('GNLY') || markersSet.has('NKG7')) return 'NK cells';
  if (markersSet.has('FCER1A') || markersSet.has('CST3')) return 'Dendritic cells';
  if (markersSet.has('PPBP')) return 'Megakaryocytes';
  return `Cluster ${clusterName} (unannotated)`;
}

function updateLegend() {
  const legendEl = document.getElementById('legend');
  if (!legendEl || !manifest) return;

  const mode = document.getElementById('colorModeSelect').value;

  // R2: Continuous legend in real log-normalised units + zero & p99 clip notes
  if (mode === 'gene') {
    const gene = document.getElementById('geneSelect').value;
    const geneMeta = manifest.genes?.[gene];
    const hiVal = typeof geneMeta?.hi === 'number' ? geneMeta.hi.toFixed(2) : 'p99';

    legendEl.innerHTML = `
      <div><strong>${gene || 'Gene'}</strong> (log-norm)</div>
      <div style="height:10px; border-radius:2px; margin:4px 0; background:linear-gradient(to right, #00224e, #575c6e, #b89b74, #fee838);"></div>
      <div style="display:flex; justify-content:space-between; color:#ccc;">
        <span>0 (zero)</span>
        <span>≥ ${hiVal} (p99 clip)</span>
      </div>
      <div style="color:#9aa0a6; margin-top:2px;">0 = no detected counts; values ≥ p99 clip at max Cividis</div>
    `;
    return;
  }

  // R4 note when in uncertainty mode
  if (mode === 'uncertainty') {
    legendEl.innerHTML = `
      <div><strong>Uncertainty</strong> (1 − k-NN purity, k=15)</div>
      <div style="color:#ccc; margin-top:2px;">Higher uncertainty fades/desaturates points toward grey while keeping cluster hue readable.</div>
    `;
    return;
  }

  // R3: Categorical legend with cell-type annotation + marker evidence + cell count
  const categories = manifest.obs?.cluster?.categories || [];
  const rows = categories.map((catName, idx) => {
    const vec = PALETTE[Math.min(idx, PALETTE.length - 1)];
    const r = Math.round(vec.x * 255);
    const g = Math.round(vec.y * 255);
    const b = Math.round(vec.z * 255);
    const topList = markers?.markers?.[catName]?.slice(0, 2) || [];
    const markerText = topList.map((m) => m.gene).join(', ') || 'no markers';
    const cellType = inferCellTypeLabel(catName, topList);
    const nCells = getClusterCount(idx);
    const active = uniforms.uHighlight.value === idx;

    return `
      <div data-cluster-idx="${idx}" style="display:flex; align-items:center; gap:6px; padding:2px 4px; border-radius:3px; cursor:pointer; background:${active ? 'rgba(255,255,255,0.14)' : 'transparent'};">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:rgb(${r},${g},${b}); flex-shrink:0;"></span>
        <span style="flex:1;"><strong>${cellType}</strong> <span style="color:#aaa;">(${markerText})</span></span>
        <span style="color:#bbb;">${nCells.toLocaleString()}</span>
      </div>
    `;
  }).join('');

  legendEl.innerHTML = `
    <div style="margin-bottom:4px;"><strong>Clusters &amp; Marker Evidence</strong> <span style="color:#9aa0a6;">(click to highlight)</span></div>
    <div style="max-height:150px; overflow-y:auto;">${rows}</div>
  `;

  legendEl.querySelectorAll('[data-cluster-idx]').forEach((row) => {
    row.addEventListener('click', () => {
      const idx = Number(row.getAttribute('data-cluster-idx'));
      uniforms.uHighlight.value = uniforms.uHighlight.value === idx ? -1.0 : idx;
      updateLegend();
    });
  });
}