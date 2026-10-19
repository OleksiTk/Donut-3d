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

  // Hanging drip: tapered stem from (x, top) down by len, ending in a heavier bulb.
  // Coordinates: x right, y DOWN, both in units of view height.
  float drip(vec2 p, float x, float top, float len, float r) {
    float t = clamp((p.y - top) / max(len, 1e-4), 0.0, 1.0);
    float wob = 0.1 * r * sin(p.y * 38.0 + x * 17.0) * t;
    float stem = length(vec2(p.x - x, p.y - (top + len * t))) - (r * mix(1.0, 0.68, t) + wob);
    float bulb = length(p - vec2(x, top + len)) - r * 1.28 * smoothstep(0.0, 0.05, len);
    return smin(stem, bulb, r * 0.9);
  }

  float heroField(vec2 p, float W) {
    float P = uProgress;
    float sheet = easeOut(P / 0.62);
    vec2 finalR = vec2(mix(0.5, 0.86, uCompact) * W, mix(0.34, 0.17, uCompact));
    vec2 rad = finalR * mix(vec2(0.12, 0.06), vec2(1.0), sheet);
    vec2 c = vec2(-0.03, -0.05);
    vec2 q = (p - c) / rad;
    float d = (length(q) - 1.0) * min(rad.x, rad.y);
    // lumpy, slowly breathing lower edge
    d += 0.016 * sin(p.x * 9.0 + 1.3) + 0.007 * sin(p.x * 23.0 - uTime * 0.7);

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
      if (g > 0.002) d = smin(d, drip(p, x, edge - 0.02, len, dr.z), 0.035);
      // the two longest drips shed a droplet that pinches off at the end
      if (i == 1 || i == 3) {
        float fall = easeOut((P - 0.82) / 0.18);
        float dy = edge + len + dr.z * 1.4 + fall * 0.055 * lenScale;
        if (fall > 0.0) d = smin(d, length(p - vec2(x, dy)) - dr.z * 0.95, 0.02 * (1.0 - fall) + 0.002);
      }
    }
    return d;
  }

  float curtainField(vec2 p, float W) {
    float P = uProgress;
    float hw = 0.5 * W;
    float left = step(p.x, hw);
    float xm = min(p.x, W - p.x);                         // mirror into one half
    float band = mix(0.02, 0.05, easeOut(P / 0.3)) + 0.01 * sin(p.x * 7.0 + 0.5);
    float d = p.y - band;

    vec4 drips[6]; // x as fraction of the half width, length, radius, delay
    drips[0] = vec4(0.00, 1.15, 0.075, 0.00);
    drips[1] = vec4(0.08, 0.86, 0.034, 0.06);
    drips[2] = vec4(0.17, 0.64, 0.030, 0.14);
    drips[3] = vec4(0.28, 0.46, 0.024, 0.22);
    drips[4] = vec4(0.41, 0.30, 0.020, 0.30);
    drips[5] = vec4(0.58, 0.16, 0.015, 0.36);
    float spread = mix(1.0, 0.32, uCompact);
    for (int i = 0; i < 6; i++) {
      vec4 dr = drips[i];
      float jitter = mix(0.92, 1.08, left);               // the two sides differ a little
      float g = easeInOut((P - dr.w) / 0.58);
      float x = dr.x * hw * spread * jitter;
      float r = dr.z * mix(1.0, 0.5, uCompact);           // thinner on narrow screens
      if (g > 0.002) d = smin(d, drip(vec2(xm, p.y), x, band - 0.02, dr.y * g * jitter, r), 0.04);
    }

    // the frosting pools at the bottom and becomes the dark floor of the finale
    float pool = 0.02 + 0.3 * easeInOut((P - 0.55) / 0.45)
               + 0.012 * sin(p.x * 6.0 + uTime * 0.5) * smoothstep(0.55, 0.8, P);
    d = smin(d, (1.0 - pool) - p.y, 0.09);
    return d;
  }

  float field(vec2 p, float W) {
    return uMode == 0 ? heroField(p, W) : curtainField(p, W);
  }

  // rounded (circular) cross-section: 0 at the edge, 1 once thicker than T
  float heightAt(float d, float T, vec2 p) {
    float x = clamp(-d / T, 0.0, 1.0);
    float h = sqrt(1.0 - (1.0 - x) * (1.0 - x));
    // hero only: a slow, low swell across the sheet so the interior catches light too
    // (the curtains stay flat so their pool matches the finale background exactly)
    if (uMode == 0) h += smoothstep(0.0, 1.0, -d / (T * 5.0)) * 1.2 * (sin(p.x * 3.1 + p.y * 2.3 + uTime * 0.15) + 0.6 * sin(p.y * 5.2 - p.x * 1.7));
    return h;
  }

  void main() {
    float W = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * W, 1.0 - vUv.y);
    float px = 1.0 / uRes.y;
    float T = 0.032;

    float d = field(p, W);
    float e = 1.5 * px;
    float h0 = heightAt(d, T, p);
    float hx = heightAt(field(p + vec2(e, 0.0), W), T, p + vec2(e, 0.0));
    float hy = heightAt(field(p + vec2(0.0, e), W), T, p + vec2(0.0, e));

    // slope → normal (screen space, y up)
    float slope = T * 0.9 / e;
    vec3 n = normalize(vec3(-(hx - h0) * slope, (hy - h0) * slope, 1.0));
    vec3 L = normalize(vec3(-0.5, 0.65, 0.75));
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

    // every term is zero on a flat surface so the interior is exactly uColor
    float shade = dot(n, L) - L.z;
    vec3 col = uColor * (1.0 + 0.9 * shade);
    float body = clamp(-d / T, 0.0, 1.0);
    float edgeH = sqrt(1.0 - (1.0 - body) * (1.0 - body));
    col = mix(col, uDeep, (1.0 - smoothstep(0.0, 0.6, edgeH)) * 0.55);

    float nh = max(dot(n, H), 0.0);
    float broad = uMode == 0 ? 0.35 : 0.2;
    float spec = pow(nh, 140.0) * 1.1 + max(pow(nh, 18.0) - pow(H.z, 18.0), 0.0) * broad;
    vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
    float windowBand = smoothstep(0.16, 0.3, R.y) * smoothstep(0.62, 0.4, R.y) * smoothstep(-0.7, 0.1, R.x);
    float bounce = smoothstep(0.25, 0.7, -R.y);
    // black glaze gets a narrower reflection, or it starts to read as chrome
    float bandStrength = uMode == 0 ? 0.3 : 0.1;
    col += vec3(1.0) * (spec + windowBand * bandStrength) + uColor * bounce * 0.25;

    float alpha = clamp(0.5 - d / (1.2 * px), 0.0, 1.0);

    // soft contact shadow cast down-right onto the page
    float ds = field(p - vec2(0.006, 0.014), W);
    float shadowA = uShadowAlpha * (1.0 - smoothstep(-0.012, 0.03, ds));

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

export function Glaze({ mode, color, deep, shadow, shadowAlpha = 0.22, progress }: GlazeProps) {
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
