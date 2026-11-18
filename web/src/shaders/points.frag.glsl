varying vec3 vColor;
varying float vValue;

uniform sampler2D uLut;      // 1D lookup texture for sequential colormap
uniform float uMode;         // 0.0 = cluster, 1.0 = uncertainty, 2.0 = gene expression
uniform float uCvd;          // 0.0 = normal, 1.0 = simulate deuteranopia

// Deuteranopia simulation matrix (Machado et al.)
const mat3 DEUTAN = mat3(
   0.367322,  0.280085, -0.011820,
   0.860646,  0.672501,  0.042940,
  -0.227968,  0.047413,  0.968881
);

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c)   { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }

void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    
    // Cut square into a flat disc
    if (dot(p, p) > 1.0) discard;

    vec3 finalColor = vColor;

    // If gene expression mode (uMode == 2.0), sample from the 1D LUT texture
    if (uMode > 1.5) {
        float t = (vValue * 255.0 + 0.5) / 256.0;
        finalColor = texture2D(uLut, vec2(t, 0.5)).rgb;
    }

    // CVD Simulation check
    if (uCvd > 0.5) {
        finalColor = toSRGB(DEUTAN * toLinear(finalColor));
    }

    gl_FragColor = vec4(finalColor, 1.0);
}