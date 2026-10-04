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
  vPoint = aPosition * 1.65;
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
  if (radial > 1.62) discard;
  float seed = vShape.x;
  float age = vShape.y;
  float weather = vShape.w;
  vec2 wind = vec2(cos(seed), sin(seed));
  vec2 drift = wind * uTime * (.065 + weather * .16);
  float field = perlin(vPoint * 1.5 + seed - drift);
  float fine = radial < 1.1 ? perlin(vPoint * 5.5 - seed - drift * .7) : 0.0;
  float aa = max(fwidth(radial), .001);
  float stroke = .68 / max(vRadius, 1.0);

  // Successive fronts expand from the same white dot, then erode with distance.
  float rings = 0.0;
  float halo = 0.0;
  float sourceEnergy = 0.0;
  for (int i = 0; i < 3; i++) {
    float travel = age * 1.55 - float(i) * .22;
    float reach = max(0.0, travel);
    float distortion = field * .045 * smoothstep(.1, .65, reach) * uComplexity;
    float delta = abs(radial + distortion - reach);
    float start = smoothstep(0.0, .055, travel);
    float fade = 1.0 - smoothstep(.55, 1.05, reach);
    float erosion = smoothstep(-.48 + reach * .55, -.25 + reach * .55, field + fine * .2);
    float visibility = start * fade * mix(1.0, erosion, smoothstep(.4, 1.0, reach));
    sourceEnergy += start * fade * exp(-max(travel, 0.0) * 2.8);
    rings += (1.0 - smoothstep(stroke, stroke + aa, delta)) * visibility;
    halo += (1.0 - smoothstep(stroke, stroke + 5.0 / vRadius, delta)) * .065 * visibility;
  }

  // A smooth advected pressure field: cool fringes, warm localized high-energy cores.
  vec2 crosswind = vec2(-wind.y, wind.x);
  vec2 offset = wind * sin(uTime * .26 + seed) * (.18 + weather * .42)
              + crosswind * cos(uTime * .19 + seed * 1.7) * (.12 + weather * .22);
  vec2 q = vPoint - offset;
  q = vec2(q.x * wind.x + q.y * wind.y, -q.x * wind.y + q.y * wind.x);
  q *= vec2(.78 + .12 * sin(uTime * .23 + seed), 1.05);
  q += vec2(field, -field) * (.2 + weather * .28);
  float pressure = exp(-dot(q,q) * 1.05) * (.65 + weather * .55);
  pressure *= smoothstep(-.65, .55, field);
  float boundary = 1.0 - smoothstep(.85, 1.62, radial);
  float formation = smoothstep(0.0, .16, age) * (1.0 - smoothstep(.62, 1.0, age));
  float strength = pressure * boundary * formation;
  vec3 cold = mix(vec3(.08,.06,.42), vec3(.02,.37,.63), smoothstep(.04,.25,pressure));
  vec3 warm = mix(vec3(.06,.66,.67), vec3(1.0,.34,.08), smoothstep(.25,.62,pressure));
  vec3 weatherColor = mix(cold, warm, smoothstep(.12,.5,pressure) * weather);
  float haze = strength * (.23 + weather * .38);
  float lineAlpha = clamp((rings * .83 + halo) * vColor.a, 0.0, .9);
  float hazeAlpha = haze * vColor.a;
  // A pale-blue source gradient swells with newly emitted fronts and their reach.
  float magnitude = clamp((vRadius - 48.0) / 102.0, 0.0, 1.0);
  float glowRadius = .16 + magnitude * .17 + sourceEnergy * .06;
  float sourceGlow = exp(-radial * radial / (glowRadius * glowRadius));
  float sourceAlpha = sourceGlow * (.10 + magnitude * .16 + sourceEnergy * .25) * vColor.a;
  vec3 light = vColor.rgb * lineAlpha + weatherColor * hazeAlpha + vec3(.32,.68,1.0) * sourceAlpha;
  float alpha = clamp(lineAlpha + hazeAlpha + sourceAlpha, 0.0, 1.0);
  finalColor = vec4(light, alpha);
}`
