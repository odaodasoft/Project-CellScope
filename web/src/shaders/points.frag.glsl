varying vec3 vColor;

void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    
    // Cut square into a disc
    if (r2 > 1.0) discard;

    // Fake sphere normal: z = sqrt(1 - x^2 - y^2)
    vec3 normal = vec3(p, sqrt(1.0 - r2));
    
    // Direction of the light (e.g., coming from top-right-front)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.5));
    
    // Diffuse lighting: dot product of normal and light direction
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    // Add ambient light so the dark side isn't pitch black
    float ambient = 0.4;
    float lighting = ambient + (1.0 - ambient) * diffuse;

    gl_FragColor = vec4(vColor * lighting, 1.0);
}