// One instanced quad per visible bloom. Edges are analytic, not magnified textures.
export const bloomVertex = `#version 300 es
in vec2 aPosition;
in vec4 aBloom;
in vec4 aColor;
in vec4 aShape;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vPoint;
out vec4 vColor;
out vec4 vShape;
out float vRadius;
void main() {
  vPoint = aPosition * 1.3;
  vColor = aColor;
  vShape = aShape;
  vRadius = aBloom.z;
  vec2 position = aBloom.xy + vPoint * aBloom.z;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
}`

export const bloomFragment = `#version 300 es
precision highp float;
in vec2 vPoint;
in vec4 vColor;
in vec4 vShape;
in float vRadius;
uniform float uTime;
uniform float uComplexity;
out vec4 finalColor;

vec2 gradient(vec2 cell) {
  vec3 p = fract(vec3(cell.xyx) * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  vec2 g = fract((p.xx + p.yz) * p.zy) * 2.0 - 1.0;
  return g * inversesqrt(max(dot(g, g), .001));
}
float perlin(vec2 point) {
  vec2 cell = floor(point), f = fract(point);
  vec2 t = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dot(gradient(cell), f), dot(gradient(cell + vec2(1,0)), f - vec2(1,0)), t.x),
             mix(dot(gradient(cell + vec2(0,1)), f - vec2(0,1)), dot(gradient(cell + vec2(1,1)), f - vec2(1,1)), t.x), t.y);
}
void main() {
  float radial = length(vPoint);
  if (radial > 1.26) discard;
  float seed = vShape.x;
  float age = vShape.y;
  vec2 drift = vec2(uTime * .09, -uTime * .06);
  float field = perlin(vPoint * 2.3 + seed + drift);
  float fine = perlin(vPoint * 6.0 - seed + drift * .65);
  float distortion = field * (.10 + uComplexity * .10) + fine * .025 * uComplexity;
  float distance = radial + distortion;
  // Derivatives keep edges antialiased at any display density or bloom size.
  float aa = max(fwidth(distance), .001);
  float stroke = 1.15 / max(vRadius, 1.0);
  float edge = 1.0 - smoothstep(stroke, stroke + aa, abs(distance - .92));
  float inner = 1.0 - smoothstep(stroke * .6, stroke * .6 + aa, abs(distance - .73));
  float core = (1.0 - smoothstep(.25, .94, distance)) * .13;
  float veil = exp(-abs(distance - .89) * 22.0) * .16;
  float dissolve = smoothstep(.55, 1.0, age);
  float erosion = smoothstep(dissolve * 1.5 - .75, dissolve * 1.5 - .57, field + fine * .35);
  float contour = edge * .72 + inner * (.12 + uComplexity * .23) + core + veil;
  float alpha = clamp(contour * erosion * vColor.a, 0.0, .85);
  vec3 color = mix(vColor.rgb, vec3(1.0, .94, .85), edge * .16);
  finalColor = vec4(color * alpha, alpha);
}`
