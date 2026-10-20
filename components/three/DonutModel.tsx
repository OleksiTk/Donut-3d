"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export type DonutVariant = "pink" | "black" | "gold";

/**
 * The three .glb exports currently contain the same Blender scene: three donuts in a
 * row along Z plus loose "Sprinkle" particle templates at the origin. Each variant
 * therefore lists the nodes that make up *its* donut (dough, glaze, sprinkles).
 * If a file only contains one donut (a proper single export), none of these names
 * match and the whole scene is used instead.
 */
const SOURCES: Record<DonutVariant, { url: string; nodes: string[] }> = {
  pink: { url: "/Donut-pink.glb", nodes: ["Donut.006", "Donut.007", "Donut.008"] },
  black: { url: "/Donut-black.glb", nodes: ["Donut.003", "Donut.004", "Donut.005"] },
  gold: { url: "/Donut-gold.glb", nodes: ["Donut", "Donut.001", "Donut.002"] },
};

/** World-space diameter every donut is normalised to, whatever the export scale. */
export const DONUT_DIAMETER = 2;

// GLTFLoader sanitises node names ("Donut.006" → "Donut006"), so compare loosely.
const normalise = (name: string) => name.replace(/[\s._]/g, "").toLowerCase();

const isGlaze = (m: THREE.Material) => /glaze/i.test(m.name);
const isDough = (m: THREE.Material) => /pastry|donut/i.test(m.name);

const glazeTextureCache = new Map<DonutVariant, THREE.CanvasTexture>();

/** Deterministic PRNG so the procedural glaze texture is stable across renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a stamp wrapped across all 9 tile offsets so the 512×512 texture tiles seamlessly. */
function drawWrapped(size: number, x: number, y: number, pad: number, fn: (cx: number, cy: number) => void) {
  const ox = x < pad ? [0, size] : x > size - pad ? [0, -size] : [0];
  const oy = y < pad ? [0, size] : y > size - pad ? [0, -size] : [0];
  for (const dx of ox) {
    for (const dy of oy) {
      fn(x + dx, y + dy);
    }
  }
}

/**
 * Builds a bright, creamy, seamless procedural albedo texture for each glaze flavor
 * (no dark/black blotches — uses light sugar-cream swirls, soft pastel ribbons, and bright crystal glints).
 */
function getGlazeColorMap(variant: DonutVariant): THREE.CanvasTexture {
  const cached = glazeTextureCache.get(variant);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const rand = mulberry32(variant === "pink" ? 104729 : variant === "black" ? 224737 : 350377);

  if (variant === "pink") {
    // Bright, fresh strawberry-cream base
    ctx.fillStyle = "#f57aa5";
    ctx.fillRect(0, 0, size, size);

    // 1. Soft whipped-cream & vanilla-sugar marble clouds (light & airy)
    for (let i = 0; i < 110; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 28 + rand() * 64;
      const isCream = rand() > 0.32;
      drawWrapped(size, x, y, r, (cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (isCream) {
          g.addColorStop(0, "rgba(255, 226, 238, 0.36)");
          g.addColorStop(0.55, "rgba(255, 196, 218, 0.16)");
          g.addColorStop(1, "rgba(255, 196, 218, 0)");
        } else {
          g.addColorStop(0, "rgba(234, 92, 144, 0.24)");
          g.addColorStop(0.6, "rgba(240, 108, 156, 0.10)");
          g.addColorStop(1, "rgba(240, 108, 156, 0)");
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Flowing hand-poured sugar-icing ribbons
    for (let i = 0; i < 75; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 35 + rand() * 75;
      const angle = rand() * Math.PI * 2;
      const curve = (rand() - 0.5) * 28;
      drawWrapped(size, x, y, len + 12, (cx, cy) => {
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;
        const mx = (cx + ex) * 0.5 + Math.cos(angle + Math.PI / 2) * curve;
        const my = (cy + ey) * 0.5 + Math.sin(angle + Math.PI / 2) * curve;

        ctx.strokeStyle = rand() > 0.35 ? "rgba(255, 235, 243, 0.28)" : "rgba(235, 88, 140, 0.20)";
        ctx.lineWidth = 4 + rand() * 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      });
    }

    // 3. Delicate sugar-crystal micro-glints & soft rose-berry sugar specks (light, never dark)
    for (let i = 0; i < 280; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rx = 1.2 + rand() * 2.4;
      const ry = rx * (0.65 + rand() * 0.35);
      const angle = rand() * Math.PI * 2;
      const isSugarPearl = rand() > 0.42;

      drawWrapped(size, x, y, 8, (cx, cy) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = isSugarPearl ? "rgba(255, 244, 248, 0.58)" : "rgba(224, 68, 124, 0.42)";
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
  } else if (variant === "black") {
    // Warm, lighter chocolate-cocoa glaze base so the 2nd donut's texture is rich and clearly visible
    ctx.fillStyle = "#4d2836";
    ctx.fillRect(0, 0, size, size);

    // 1. Creamy cocoa-butter & warm mocha ganache marble swirls
    for (let i = 0; i < 105; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 28 + rand() * 64;
      const isLightCocoa = rand() > 0.3;
      drawWrapped(size, x, y, r, (cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (isLightCocoa) {
          g.addColorStop(0, "rgba(136, 82, 102, 0.42)");
          g.addColorStop(0.55, "rgba(110, 62, 80, 0.18)");
          g.addColorStop(1, "rgba(110, 62, 80, 0)");
        } else {
          g.addColorStop(0, "rgba(48, 22, 32, 0.32)");
          g.addColorStop(1, "rgba(48, 22, 32, 0)");
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Silky tempered-chocolate ribbons
    for (let i = 0; i < 70; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 35 + rand() * 75;
      const angle = rand() * Math.PI * 2;
      const curve = (rand() - 0.5) * 26;
      drawWrapped(size, x, y, len + 12, (cx, cy) => {
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;
        const mx = (cx + ex) * 0.5 + Math.cos(angle + Math.PI / 2) * curve;
        const my = (cy + ey) * 0.5 + Math.sin(angle + Math.PI / 2) * curve;

        ctx.strokeStyle = "rgba(158, 100, 120, 0.30)";
        ctx.lineWidth = 3.5 + rand() * 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      });
    }

    // 3. Golden-toasted sesame praline specks & bright flaky Maldon sea-salt crystals
    for (let i = 0; i < 300; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const isSalt = rand() > 0.58;
      const r = isSalt ? 1.1 + rand() * 1.9 : 1.3 + rand() * 2.4;
      const angle = rand() * Math.PI * 2;
      drawWrapped(size, x, y, 8, (cx, cy) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        if (isSalt) {
          ctx.fillStyle = "rgba(255, 245, 238, 0.62)";
          ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
        } else {
          ctx.fillStyle = "rgba(218, 174, 122, 0.58)";
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.3, r * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }
  } else {
    // Luminous 23K champagne-gold leaf over honey-butter glaze
    ctx.fillStyle = "#f2c15a";
    ctx.fillRect(0, 0, size, size);

    // 1. Bright 24K gold shimmer clouds & warm honey-butter tones
    for (let i = 0; i < 95; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 26 + rand() * 58;
      const bright = rand() > 0.35;
      drawWrapped(size, x, y, r, (cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, bright ? "rgba(255, 246, 200, 0.45)" : "rgba(222, 160, 52, 0.28)");
        g.addColorStop(1, "rgba(242, 193, 90, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Delicate gold-leaf foil veins & bright burnished creases
    for (let i = 0; i < 180; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 12 + rand() * 30;
      const angle = rand() * Math.PI * 2;
      const bend = (rand() - 0.5) * 10;
      drawWrapped(size, x, y, len + 6, (cx, cy) => {
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;
        const mx = (cx + ex) * 0.5 + Math.cos(angle + Math.PI / 2) * bend;
        const my = (cy + ey) * 0.5 + Math.sin(angle + Math.PI / 2) * bend;

        ctx.strokeStyle = rand() > 0.3 ? "rgba(255, 250, 220, 0.52)" : "rgba(214, 152, 42, 0.32)";
        ctx.lineWidth = 0.9 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      });
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 2.5);
  map.anisotropy = 8;
  map.needsUpdate = true;

  glazeTextureCache.set(variant, map);
  return map;
}

function toPhysical(source: THREE.MeshStandardMaterial) {
  const mat = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(mat, source);
  return mat;
}

function makeGold(source: THREE.MeshStandardMaterial) {
  const gold = toPhysical(source);
  gold.color.set("#ffffff");
  gold.map = getGlazeColorMap("gold");
  gold.metalness = 0.84;
  gold.roughness = 0.24;
  gold.metalnessMap = null;
  if (gold.normalMap) {
    gold.normalScale.set(0.82, 0.82);
    gold.clearcoatNormalMap = gold.normalMap;
    gold.clearcoatNormalScale.set(0.32, 0.32);
  }
  gold.clearcoat = 0.88;
  gold.clearcoatRoughness = 0.12;
  gold.emissive.set("#4a2d08");
  gold.emissiveIntensity = 0.20;
  gold.envMapIntensity = 1.6;
  gold.needsUpdate = true;
  return gold;
}

function makePinkGlaze(source: THREE.MeshStandardMaterial) {
  const pink = toPhysical(source);
  pink.color.set("#ffffff");
  pink.map = getGlazeColorMap("pink");
  pink.metalness = 0.01;
  pink.roughness = 0.28;
  // Keep the 2K Poliigon glaze normal + roughness maps with a soft, glossy clearcoat
  if (pink.normalMap) {
    pink.normalScale.set(0.85, 0.85);
    pink.clearcoatNormalMap = pink.normalMap;
    pink.clearcoatNormalScale.set(0.35, 0.35);
  }
  pink.clearcoat = 0.96;
  pink.clearcoatRoughness = 0.10;
  pink.sheen = 0.55;
  pink.sheenRoughness = 0.38;
  pink.sheenColor.set("#ffd0e2");
  pink.emissive.set("#6b1839");
  pink.emissiveIntensity = 0.22;
  pink.envMapIntensity = 1.42;
  pink.needsUpdate = true;
  return pink;
}

function makeBlackGlaze(source: THREE.MeshStandardMaterial) {
  const glossy = toPhysical(source);
  glossy.color.set("#ffffff");
  glossy.map = getGlazeColorMap("black");
  if (glossy.normalMap) {
    glossy.normalScale.set(0.82, 0.82);
    glossy.clearcoatNormalMap = glossy.normalMap;
    glossy.clearcoatNormalScale.set(0.32, 0.32);
  }
  glossy.roughness = 0.25;
  glossy.clearcoat = 0.96;
  glossy.clearcoatRoughness = 0.09;
  glossy.sheen = 0.55;
  glossy.sheenRoughness = 0.42;
  glossy.sheenColor.set("#8f5268");
  glossy.emissive.set("#28111a");
  glossy.emissiveIntensity = 0.25;
  glossy.envMapIntensity = 1.65;
  glossy.needsUpdate = true;
  return glossy;
}

function makeDough(source: THREE.MeshStandardMaterial) {
  const dough = source.clone();
  dough.emissive.set("#3d1e05");
  dough.emissiveIntensity = 0.1;
  dough.envMapIntensity = 1.15;
  dough.needsUpdate = true;
  return dough;
}

export function DonutModel({
  variant,
  ...props
}: { variant: DonutVariant } & Omit<React.ComponentProps<"group">, "children">) {
  const { url, nodes } = SOURCES[variant];
  const { scene } = useGLTF(url);

  const { model, scale } = useMemo(() => {
    const wanted = new Set(nodes.map(normalise));
    const picked = scene.children.filter((c) => wanted.has(normalise(c.name)));

    const root = new THREE.Group();
    for (const obj of picked.length ? picked : [scene]) root.add(obj.clone(true));

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (variant === "gold" && isGlaze(mat)) mesh.material = makeGold(mat);
      else if (variant === "pink" && isGlaze(mat)) mesh.material = makePinkGlaze(mat);
      else if (variant === "black" && isGlaze(mat)) mesh.material = makeBlackGlaze(mat);
      else if (isDough(mat)) mesh.material = makeDough(mat);
    });

    // Recentre on the donut's own bounds (the source nodes sit at z = 0.4 / 0.79)
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    root.position.sub(center);

    return { model: root, scale: DONUT_DIAMETER / Math.max(size.x, size.z) };
  }, [scene, nodes, variant]);

  return (
    <group {...props}>
      {/* scale on a wrapper so the recentring offset is scaled with the mesh */}
      <group scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}

// All three are fetched up front so later sections never pop in.
for (const { url } of Object.values(SOURCES)) useGLTF.preload(url);
