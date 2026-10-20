"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sceneState } from "@/lib/sceneState";

/*
 * Liquid glaze as a 2D signed-distance field drawn on a full-view quad.
 *
 * The sheet, every drip stem, its bulb and any detaching droplet are SDF primitives
 * merged with a polynomial smooth-min, so they fuse and pinch apart like real goo.
 * The distance is turned into a rounded height profile, its screen-space gradient
 * gives a normal, and the normal drives diffuse, two specular lobes, a reflected
 * "window" band and darker rims. That is what makes it read as a thick, glossy
 * liquid instead of a flat shape. Shares the page's single WebGL context.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); // fill the View's viewport
  }
`;

const fragment = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uProgress;
  uniform int uMode;        // 0 = hero pour (top-left), 1 = side curtains + pool
  uniform float uCompact;   // 1 on portrait / narrow views
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uShadow;
  uniform float uShadowAlpha;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }
  float easeOut(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
  float easeInOut(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

  // Procedural value noise & FBM for organic sugar-glaze micro-texture
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.05 + vec2(11.7, 5.3);
      a *= 0.5;
    }
    return v;
  }

  // Smooth radial distance: 0 on the boundary |v| = r, Euclidean outside, and C-infinity
  // smooth at the spine (v = 0) so drips and droplets never form a sharp center shadow ridge.
  float smoothDisk(vec2 v, float r, float T, float normMix) {
    float k = r * 0.75;
    float rk = sqrt(r * r + k * k);
    float d = sqrt(dot(v, v) + k * k) - rk;
    if (d < 0.0) {
      float fullScale = T / max(rk - k, 1e-4);
      d *= mix(1.0, max(fullScale, 1.0), normMix);
    }
    return d;
  }

  // Hanging drip: continuous tapered column ending in a plump rounded bulb.
  // Coordinates: x right, y DOWN, both in units of view height.
  float drip(vec2 p, float x, float top, float len, float r, float T) {
    float t = clamp((p.y - top) / max(len, 1e-4), 0.0, 1.0);
    // Gentle organic taper in the neck, swelling smoothly into a terminal bulb
    float neck = 1.0 - 0.22 * sin(t * 3.14159265);
    float bulb = 0.24 * smoothstep(0.45, 1.0, t) * smoothstep(0.0, 0.05, len);
    float rad = r * (neck + bulb);
    vec2 v = vec2(p.x - x, p.y - (top + len * t));
    // Fade in interior depth normalisation once clear of the parent sheet
    float normMix = smoothstep(0.0, 0.35, t);
    return smoothDisk(v, rad, T, normMix);
  }

  float heroField(vec2 p, float W, float T) {
    float P = uProgress;
    float sheet = easeOut(P / 0.62);
    vec2 finalR = vec2(mix(0.5, 0.86, uCompact) * W, mix(0.34, 0.17, uCompact));
    vec2 rad = finalR * mix(vec2(0.12, 0.06), vec2(1.0), sheet);
    vec2 c = vec2(-0.03, -0.05);
    vec2 q = (p - c) / rad;
    float d = (length(q) - 1.0) * min(rad.x, rad.y);
    // lumpy, slowly breathing lower edge
    d += 0.014 * sin(p.x * 8.5 + 1.3) + 0.005 * sin(p.x * 19.0 - uTime * 0.7);

    // drips: x as a fraction of the sheet width, length, radius, start delay
    vec4 drips[6];
    drips[0] = vec4(0.10, 0.16, 0.026, 0.18);
    drips[1] = vec4(0.27, 0.30, 0.032, 0.24);
    drips[2] = vec4(0.43, 0.13, 0.022, 0.34);
    drips[3] = vec4(0.58, 0.24, 0.028, 0.30);
    drips[4] = vec4(0.74, 0.10, 0.018, 0.42);
    drips[5] = vec4(0.86, 0.17, 0.020, 0.38);
    float lenScale = mix(1.0, 0.55, uCompact);
    for (int i = 0; i < 6; i++) {
      vec4 dr = drips[i];
      float x = c.x + dr.x * rad.x;
      float u = clamp((x - c.x) / rad.x, 0.0, 1.0);
      float edge = c.y + rad.y * sqrt(max(0.0, 1.0 - u * u));
      float g = easeInOut((P - dr.w) / (1.0 - dr.w));
      // keeps creeping very slowly once poured, like real glaze
      float creep = 1.0 + 0.03 * sin(uTime * 0.35 + float(i) * 1.7) * g;
      float len = dr.y * lenScale * g * creep;
      if (g > 0.002) d = smin(d, drip(p, x, edge - 0.015, len, dr.z, T), 0.032);
      // the two longest drips shed a droplet that pinches off at the end
      if (i == 1 || i == 3) {
        float fall = easeOut((P - 0.82) / 0.18);
        float dy = edge + len + dr.z * 1.45 + fall * 0.055 * lenScale;
        if (fall > 0.0) {
          float dropD = smoothDisk(p - vec2(x, dy), dr.z * 0.95, T, 1.0);
          d = smin(d, dropD, 0.018 * (1.0 - fall) + 0.002);
        }
      }
    }
    return d;
  }

  float curtainField(vec2 p, float W, float T) {
    float P = uProgress;
    float hw = 0.5 * W;
    float left = step(p.x, hw);
    float xm = min(p.x, W - p.x);                         // mirror into one half
    float band = mix(0.02, 0.05, easeOut(P / 0.3)) + 0.01 * sin(p.x * 7.0 + 0.5);
    float d = p.y - band;

    // Solid side margin curtain so the outer screen edges never split open or form vertical chrome seams
    float sideWall = xm - mix(0.065, 0.025, uCompact) * hw * easeInOut(P / 0.45);
    d = smin(d, sideWall, 0.045);

    vec4 drips[6]; // x as fraction of the half width, length, radius, delay
    drips[0] = vec4(0.03, 1.15, 0.055, 0.00);
    drips[1] = vec4(0.10, 0.86, 0.034, 0.06);
    drips[2] = vec4(0.19, 0.64, 0.030, 0.14);
    drips[3] = vec4(0.29, 0.46, 0.024, 0.22);
    drips[4] = vec4(0.41, 0.30, 0.020, 0.30);
    drips[5] = vec4(0.58, 0.16, 0.016, 0.36);
    float spread = mix(1.0, 0.32, uCompact);
    for (int i = 0; i < 6; i++) {
      vec4 dr = drips[i];
      float jitter = mix(0.92, 1.08, left);               // the two sides differ a little
      float g = easeInOut((P - dr.w) / 0.58);
      float x = dr.x * hw * spread * jitter;
      float r = dr.z * mix(1.0, 0.5, uCompact);           // thinner on narrow screens
      if (g > 0.002) d = smin(d, drip(vec2(xm, p.y), x, band - 0.015, dr.y * g * jitter, r, T), 0.038);
    }

    // the frosting pools at the bottom and becomes the dark floor of the finale
    float pool = 0.03 + 0.31 * easeInOut((P - 0.50) / 0.50)
               + 0.011 * sin(p.x * 6.0 + uTime * 0.5) * smoothstep(0.50, 0.80, P);
    d = smin(d, (1.0 - pool) - p.y, 0.08);
    return d;
  }

  float field(vec2 p, float W, float T) {
    return uMode == 0 ? heroField(p, W, T) : curtainField(p, W, T);
  }

  // Smooth C2 meniscus profile: 0 at the edge, 1 once thicker than T, plus gentle glossy glaze ripples
  float heightAt(float d, float T, vec2 p) {
    float x = clamp(-d / T, 0.0, 1.0);
    float inv = 1.0 - x;
    float h = sqrt(1.0 - inv * inv * inv);
    float interior = smoothstep(0.0, 0.65, x);

    // Gentle, low-frequency hand-poured glaze ripples so normals stay bright and glossy
    vec2 flowP = vec2(p.x * 10.0, p.y * 7.5 - uProgress * 0.35);
    float softRipples = (fbm(flowP) - 0.5) * 0.065;
    float pourRibbons = sin(p.x * 15.0 + fbm(p * 4.5) * 2.5) * 0.022;
    h += (softRipples + pourRibbons) * interior;

    if (uMode == 0) {
      h += smoothstep(0.0, 1.0, -d / (T * 4.5)) * 0.22 * (sin(p.x * 2.6 + p.y * 2.0 + uTime * 0.15) + 0.5 * sin(p.y * 4.2 - p.x * 1.5));
    }
    return h;
  }

  void main() {
    float W = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * W, 1.0 - vUv.y);
    float px = 1.0 / uRes.y;
    float T = 0.030;

    float d = field(p, W, T);
    float e = 2.0 * px;
    float h0 = heightAt(d, T, p);
    float hx = heightAt(field(p + vec2(e, 0.0), W, T), T, p + vec2(e, 0.0));
    float hy = heightAt(field(p + vec2(0.0, e), W, T), T, p + vec2(0.0, e));

    // slope → normal (screen space, y up)
    float slope = T * 0.70 / e;
    // In curtain mode, fade out all edge/surface shading near the outer screen borders and bottom pool floor
    // so the dark cocoa frame merges 100% seamlessly into the #1c0c12 HTML background of section 3
    float floorFade = 1.0;
    if (uMode == 1) {
      floorFade = smoothstep(0.0, 0.035 * W, p.x) * smoothstep(0.0, 0.035 * W, W - p.x) * smoothstep(0.88, 0.68, p.y);
      slope *= floorFade;
    }
    vec3 n = normalize(vec3(-(hx - h0) * slope, (hy - h0) * slope, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.6, 0.8));
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

    // Translucent subsurface-style shading: keep shadows soft and lifted
    float shade = dot(n, L) - L.z;
    float warmLift = max(shade, 0.0);
    float deepMix = clamp(-shade * 0.35, 0.0, 0.28) * floorFade;
    vec3 col = mix(uColor, uDeep, deepMix);
    col = mix(col, min(uColor * 1.22 + vec3(0.08), vec3(1.0)), warmLift * 0.62 * floorFade);

    // Light, creamy sugar-icing marbling & bright crystal glints (no dark blotches)
    float body = clamp(-d / T, 0.0, 1.0);
    float innerMask = smoothstep(0.15, 0.65, body);
    if (uMode == 0) {
      float swirl = fbm(p * 6.0 + vec2(0.0, -uProgress * 0.35));
      float creamRibbon = smoothstep(0.46, 0.76, sin(p.x * 11.0 + swirl * 4.2 + p.y * 4.0) * 0.5 + 0.5);
      float sugarPearl = smoothstep(0.75, 0.89, vnoise(p * 68.0 + swirl * 2.0));

      // Whipped strawberry-cream ribbons & bright sugar pearls
      col = mix(col, vec3(0.99, 0.73, 0.84), creamRibbon * 0.24 * innerMask);
      col = mix(col, vec3(1.0, 0.92, 0.96), sugarPearl * 0.28 * innerMask);
    } else {
      // Warm, lighter milk-cocoa sheen swirls & golden sesame glints on the upper hanging drips
      float cocoaSwirl = fbm(p * vec2(7.0, 5.0) + vec2(0.0, -uProgress * 0.30));
      float creamVein = smoothstep(0.45, 0.78, sin(p.x * 12.0 + cocoaSwirl * 4.0) * 0.5 + 0.5);
      float sesameGlint = smoothstep(0.78, 0.90, vnoise(p * 74.0 + cocoaSwirl * 1.8));
      col = mix(col, vec3(0.32, 0.16, 0.22), creamVein * 0.28 * innerMask * floorFade);
      col = mix(col, vec3(0.68, 0.48, 0.38), sesameGlint * 0.22 * innerMask * floorFade);
    }

    float edgeH = sqrt(1.0 - (1.0 - body) * (1.0 - body));
    col = mix(col, uDeep, (1.0 - smoothstep(0.0, 0.55, edgeH)) * 0.24 * floorFade);

    float nh = max(dot(n, H), 0.0);
    float broad = uMode == 0 ? 0.25 : 0.08;
    float sharpSpec = pow(nh, 125.0) * (uMode == 0 ? 0.98 : 0.55);
    float broadSpec = max(pow(nh, 18.0) - pow(H.z, 18.0), 0.0) * broad;
    // Sugar-crystal micro-glint along the highlight
    float sugarSparkle = smoothstep(0.66, 0.90, vnoise(p * 92.0)) * pow(nh, 22.0) * (uMode == 0 ? 0.40 : 0.20);
    vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
    float windowBand = smoothstep(0.18, 0.32, R.y) * smoothstep(0.62, 0.4, R.y) * smoothstep(-0.65, 0.1, R.x);
    float bounce = smoothstep(0.25, 0.7, -R.y) * floorFade;
    float bandStrength = uMode == 0 ? 0.24 : 0.05;
    vec3 specTint = uMode == 0 ? vec3(1.0, 0.97, 0.98) : vec3(0.90, 0.78, 0.82);
    col += (specTint * (sharpSpec + broadSpec + sugarSparkle + windowBand * bandStrength) + uColor * bounce * 0.18) * floorFade;

    float alpha = clamp(0.5 - d / (1.2 * px), 0.0, 1.0);

    // Subtle, soft contact shadow cast down-right onto the page
    float ds = field(p - vec2(0.004, 0.009), W, T);
    float shadowA = uShadowAlpha * smoothstep(0.022, -0.006, ds) * floorFade;

    float A = alpha + shadowA * (1.0 - alpha);
    vec3 rgb = (col * alpha + uShadow * shadowA * (1.0 - alpha)) / max(A, 1e-5);
    gl_FragColor = vec4(rgb, A);
    #include <colorspace_fragment>
  }
`;

type GlazeProps = {
  mode: "hero" | "curtains";
  color: string;
  deep: string;
  shadow: string;
  shadowAlpha?: number;
  progress: () => number;
};

export function Glaze({ mode, color, deep, shadow, shadowAlpha = 0.10, progress }: GlazeProps) {
  const size = useThree((s) => s.size); // inside a <View> this is the view's own rect

  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uMode: { value: mode === "hero" ? 0 : 1 },
      uCompact: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uDeep: { value: new THREE.Color(deep) },
      uShadow: { value: new THREE.Color(shadow) },
      uShadowAlpha: { value: shadowAlpha },
    }),
    [mode, color, deep, shadow, shadowAlpha],
  );

  useFrame((_, delta) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uRes.value.set(size.width, size.height);
    u.uCompact.value = size.width < size.height * 0.95 ? 1 : 0;
    u.uProgress.value = progress();
    if (!sceneState.reduced) u.uTime.value += delta;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
