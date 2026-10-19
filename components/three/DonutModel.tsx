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

function makeGold(source: THREE.MeshStandardMaterial) {
  const gold = source.clone();
  gold.color.set("#e2a73f");
  gold.metalness = 1;
  gold.roughness = 0.24;
  gold.roughnessMap = null;
  gold.metalnessMap = null;
  gold.envMapIntensity = 1.5;
  gold.needsUpdate = true;
  return gold;
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
      else if (variant === "black" && isGlaze(mat)) {
        // Licorice glaze: keep the model's material, just let it catch more of the studio
        const glossy = mat.clone();
        glossy.envMapIntensity = 1.4;
        mesh.material = glossy;
      }
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
