attribute float aCluster;        // cluster code of this cell (0, 1, 2 ...)
attribute float aValue;          // normalised value for uncertainty or gene expression (0..1)

uniform float uWorldSize;        // point diameter in world units
uniform float uPxPerUnit;        // H / (2 tan(fov/2)), set from JavaScript
uniform float uHighlight;        // cluster code to highlight, -1 for none
uniform float uMode;             // 0.0 = cluster, 1.0 = uncertainty, 2.0 = gene expression
uniform vec3 uPalette[12];       // one sRGB colour per cluster code
 
varying vec3 vColor;
varying float vValue;            // passed to fragment shader for gene texture lookup
 
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);   // model space -> view space
  gl_Position = projectionMatrix * mv;               // view space -> clip space
 
  gl_PointSize = uWorldSize * uPxPerUnit / -mv.z;    // pixels; -mv.z is depth in front of camera
 
  int code = min(int(aCluster + 0.5), 11);           // guard against an index outside palette
 
  // Mode-based color selection
  if (uMode < 0.5) {
    // Mode 0: Cluster colors
    vColor = uPalette[code];
  } else if (uMode < 1.5) {
    // Mode 1: Uncertainty desaturation (fades cluster color toward neutral grey)
    vec3 baseColor = uPalette[code];
    float grey = dot(baseColor, vec3(0.299, 0.587, 0.114));
    vColor = mix(baseColor, vec3(grey), aValue);
  } else {
    // Mode 2: Gene expression (passes aValue to fragment shader for sequential colormap lookup)
    vValue = aValue;
    vColor = vec3(aValue); 
  }

  // Highlight logic: check if this cell's cluster matches the highlighted cluster
  if (abs(float(code) - uHighlight) < 0.5) {
    gl_PointSize *= 1.6;                      // Make it larger
    vColor = mix(vColor, vec3(1.0), 0.3);     // Mix 30% white to make it brighter
  }
}