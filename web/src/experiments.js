import * as THREE from 'three';
 
// Transform cell number i from model space to pixel coordinates, step by step.
export function projectByHand(i) {
  const { camera, points, renderer } = window.cs;
  const pos = points.geometry.attributes.position;
  const v = new THREE.Vector4(pos.getX(i), pos.getY(i), pos.getZ(i), 1);
  camera.updateMatrixWorld();
 
  // TODO 1: world space   (hint: v.applyMatrix4(points.matrixWorld))
  // TODO 2: view space    (camera.matrixWorldInverse)
  // TODO 3: clip space    (camera.projectionMatrix)
  // TODO 4: NDC           (perspective divide: x/w, y/w, z/w)
  // TODO 5: pixels        (map NDC in [-1,1] to the canvas size, remember that y is flipped)
  // Print the result of every step.
 
  // Reference result from the library for comparison:
  const ref = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).project(camera);
  console.log('library NDC:', ref);
}