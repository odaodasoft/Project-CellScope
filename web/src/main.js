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

// Add lights for the instanced spheres (Phong material)
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
};
 
function updatePointScale() {
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  uniforms.uPxPerUnit.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', updatePointScale);
updatePointScale();
 
let currentMesh = null; // Can be THREE.Points or THREE.InstancedMesh
let renderMode = 'points'; // 'points' or 'spheres'
let currentEmbeddingKey = 'pca';
let material = null, manifest = null, clusterCodes = null, markers = null;
 
async function loadCells(embeddingKey = 'pca') {
  if (!manifest) manifest = await loadManifest();
  currentEmbeddingKey = embeddingKey;
  const embMeta = manifest.embeddings[embeddingKey];
  
  const positions = await loadF32('/data/' + embMeta.file);
  const clusterFile = embMeta.synthetic ? embMeta.cluster_file : manifest.obs.cluster.file;
  clusterCodes = await loadU8('/data/' + clusterFile);
  if (!markers) markers = await loadJSON('/data/' + manifest.markers);
 
  const n_cells = embMeta.n_cells || manifest.n_cells;

  if (positions.length !== n_cells * 3) throw new Error('positions: size mismatch');
  if (clusterCodes.length !== n_cells) throw new Error('cluster codes: size mismatch');

  // Clean up old mesh
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
    // Instanced Spheres Variant
    const sphereGeo = new THREE.IcosahedronGeometry(0.015, 1);
    const sphereMat = new THREE.MeshPhongMaterial({ shininess: 40 });
    
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
}
 
loadCells('pca').catch((err) => { console.error(err); hud.textContent = String(err); });
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
    // Points use hits[0].index, InstancedMesh uses hits[0].instanceId
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
// ---- CONTENT END ----

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