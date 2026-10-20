"use client";

import {
  ContactShadows,
  Environment,
  Lightformer,
  PerspectiveCamera,
  PresentationControls,
  Sparkles,
  View,
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sceneState } from "@/lib/sceneState";
import { DonutModel } from "./DonutModel";
import { Glaze } from "./Glaze";

type ViewProps = { active: boolean };

const { lerp, damp, smoothstep } = THREE.MathUtils;

/** Studio built from Lightformers: crisp reflections without fetching an HDRI. */
function Studio({ warm = false }: { warm?: boolean }) {
  return (
    <>
      <Environment resolution={256} frames={1}>
        {warm && (
          <>
            <color attach="background" args={["#2a1606"]} />
            <Lightformer form="rect" intensity={2.2} color="#ffcf7a" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
            <Lightformer form="rect" intensity={1.6} color="#ffb84d" position={[0, 0, -6]} scale={[12, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#fff0cc" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 6, 1]} />
          </>
        )}
        <Lightformer form="rect" intensity={3} position={[0, 5, 2]} rotation-x={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[5, 0, 2]} rotation-y={-Math.PI / 2} scale={[6, 0.6, 1]} />
        <Lightformer
          form="ring"
          intensity={warm ? 4 : 1.5}
          color={warm ? "#ffd38a" : "#ffffff"}
          position={[2, 2, 6]}
          scale={2}
        />
      </Environment>
      <directionalLight position={[-3, 4, 5]} intensity={1.15} />
      <directionalLight position={[4, -2.5, 3.5]} intensity={0.55} color="#ffe4d6" />
      <ambientLight intensity={0.45} />
    </>
  );
}

function Camera({ distance = 6.0 }: { distance?: number }) {
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 0, distance]}
      fov={32}
      onUpdate={(cam) => cam.layers.enable(1)}
    />
  );
}

const haloShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uOpacity;
    uniform vec3 uColor;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float glow = pow(1.0 - smoothstep(0.0, 1.0, r), 1.8);
      gl_FragColor = vec4(uColor, glow * uOpacity * 0.9);
      #include <colorspace_fragment>
    }
  `,
};

/* ───────────── Hero ───────────── */

export function HeroGlazeView({ active }: ViewProps) {
  return (
    <View className="absolute inset-0" index={1} visible={active}>
      <Glaze
        mode="hero"
        color="#ed749f"
        deep="#c43b6e"
        shadow="#b5743b"
        shadowAlpha={0.09}
        progress={() => sceneState.heroGlaze}
      />
    </View>
  );
}

function HeroDonut({ active }: ViewProps) {
  const spin = useRef<THREE.Group>(null);
  const floatGroup = useRef<THREE.Group>(null);
  const glint = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.ShaderMaterial>(null);
  const dragging = useRef(false);
  const speed = useRef(1);
  const clock = useRef(0);

  const haloUniforms = useMemo(
    () => ({ uOpacity: { value: 0.65 }, uColor: { value: new THREE.Color("#fff2cc") } }),
    [],
  );

  useEffect(() => {
    const release = () => (dragging.current = false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  useFrame(({ scene }, dt) => {
    if (!active || !spin.current) return;
    const still = sceneState.reduced;
    if (!still) clock.current += dt;
    const c = clock.current;

    // ease the idle spin out while the user holds the donut, back in after
    const target = dragging.current || still ? 0 : 1;
    speed.current = damp(speed.current, target, 3, dt);
    spin.current.rotation.y += dt * 0.4 * speed.current;

    if (floatGroup.current && !still) {
      floatGroup.current.position.y = Math.sin(c * 1.3) * 0.04;
    }

    // Sweep a warm studio key light across the strawberry glaze and gently shimmer reflections
    if (!still) scene.environmentRotation.y = Math.sin(c * 0.35) * 0.28;
    if (glint.current) {
      glint.current.position.set(Math.sin(c * 0.75) * 2.2, 1.5 + Math.cos(c * 0.5) * 0.25, 2.3);
      glint.current.intensity = 10.5;
    }
    if (halo.current) {
      halo.current.uniforms.uOpacity.value = 0.62 + 0.1 * Math.sin(c * 1.4);
    }
  });

  return (
    <>
      <mesh layers={1} position={[0, 0.22, -1.2]}>
        <planeGeometry args={[3.4, 3.4]} />
        <shaderMaterial ref={halo} transparent depthWrite={false} uniforms={haloUniforms} {...haloShader} />
      </mesh>
      <group position={[0, 0.22, 0]}>
        <PresentationControls
          global={false}
          cursor
          snap={false}
          speed={1.6}
          polar={[-0.6, 0.7]}
          azimuth={[-Infinity, Infinity]}
          damping={0.25}
        >
          <group ref={floatGroup}>
            <group rotation={[0.9, 0, 0.14]}>
              <group ref={spin} onPointerDown={() => (dragging.current = true)}>
                <DonutModel variant="pink" />
              </group>
            </group>
          </group>
        </PresentationControls>
      </group>
      <pointLight ref={glint} color="#fff4e0" distance={7.5} decay={2} intensity={10.5} />
      <pointLight position={[2.4, -1.1, 2.0]} color="#ffa6c1" distance={6.5} decay={2} intensity={5.5} />
      <pointLight position={[-2.2, -1.6, 1.5]} color="#ffe2a8" distance={6} decay={2} intensity={3.8} />
      <Sparkles layers={1} position={[0, 0.22, 0]} count={28} scale={[3.2, 2.4, 1.8]} size={1.9} speed={sceneState.reduced ? 0 : 0.28} color="#fff6dc" opacity={0.65} noise={0.5} />
      {active && (
        <ContactShadows position={[0, -1.08, 0]} opacity={0.26} scale={7.5} blur={2.4} far={3.8} resolution={256} color="#9e5a2b" />
      )}
    </>
  );
}

export function HeroDonutView({ active }: ViewProps) {
  return (
    <View className="absolute -inset-8 md:-inset-12" index={2} visible={active}>
      <Camera distance={6.1} />
      <Studio />
      <Suspense fallback={null}>
        <HeroDonut active={active} />
      </Suspense>
    </View>
  );
}

/* ───────────── Black ───────────── */

export function BlackDripsView({ active }: ViewProps) {
  return (
    <View className="absolute inset-0" index={1} visible={active}>
      <Glaze
        mode="curtains"
        color="#1c0c12"
        deep="#0c0407"
        shadow="#6b4a1e"
        shadowAlpha={0.10}
        progress={() => sceneState.black}
      />
    </View>
  );
}

function BlackDonut({ active }: ViewProps) {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const speed = useRef(1);
  const idle = useRef(0);

  useEffect(() => {
    const release = () => (dragging.current = false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  useFrame((_, dt) => {
    if (!active || !root.current || !tilt.current || !spin.current) return;
    const p = sceneState.black;
    const appear = smoothstep(p, 0.08, 0.42);
    const still = sceneState.reduced;

    const target = dragging.current || still ? 0 : 1;
    speed.current = damp(speed.current, target, 3, dt);
    idle.current += dt * 0.4 * speed.current;

    root.current.scale.setScalar(Math.max(appear, 0.001));
    root.current.position.y = lerp(-0.65, 0.14, appear);
    tilt.current.rotation.x = lerp(1.5, 0.75, appear);
    spin.current.rotation.y = p * Math.PI * 2.4 + idle.current;
  });

  return (
    <>
      <group ref={root}>
        <PresentationControls
          global={false}
          cursor
          snap={false}
          speed={1.6}
          polar={[-0.6, 0.7]}
          azimuth={[-Infinity, Infinity]}
          damping={0.25}
        >
          <group ref={tilt}>
            <group ref={spin} onPointerDown={() => (dragging.current = true)}>
              <DonutModel variant="black" />
            </group>
          </group>
        </PresentationControls>
      </group>
      <pointLight position={[-2.2, 1.8, 2.5]} color="#ffe8d6" distance={7} decay={2} intensity={7} />
      <pointLight position={[2.2, -1.2, 2.0]} color="#d48ca6" distance={6} decay={2} intensity={4} />
      {active && (
        <ContactShadows position={[0, -1.06, 0]} opacity={0.35} scale={7.2} blur={2.5} far={3.8} resolution={256} color="#3b1a22" />
      )}
    </>
  );
}

export function BlackDonutView({ active }: ViewProps) {
  return (
    <View className="absolute -inset-8 md:-inset-12" index={2} visible={active}>
      <Camera distance={6.05} />
      <Studio />
      <Suspense fallback={null}>
        <BlackDonut active={active} />
      </Suspense>
    </View>
  );
}

/* ───────────── Gold ───────────── */

function GoldDonut({ active }: ViewProps) {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const sparkles = useRef<THREE.Group>(null);
  const glint = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.ShaderMaterial>(null);
  const dragging = useRef(false);
  const speed = useRef(1);
  const idle = useRef(0);
  const haloUniforms = useMemo(
    () => ({ uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#e9a43c") } }),
    [],
  );
  const clock = useRef(0);

  useEffect(() => {
    const release = () => (dragging.current = false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  // `scene` here is the View's own portal scene
  useFrame(({ scene }, dt) => {
    if (!active || !root.current || !tilt.current || !spin.current) return;
    const t = sceneState.gold;
    const still = sceneState.reduced;
    if (!still) clock.current += dt;
    const c = clock.current;

    const target = dragging.current || still ? 0 : 1;
    speed.current = damp(speed.current, target, 3, dt);
    idle.current += dt * 0.4 * speed.current;

    // rise out of the glow while growing and unwinding three turns; starts small and
    // inside the frame so the view's scissor edge never clips it
    root.current.position.y = lerp(-0.85, 0.14, t) + Math.sin(c * 1.1) * 0.05 * t;
    root.current.scale.setScalar(lerp(0.3, 1, t));
    root.current.visible = t > 0.001;
    spin.current.rotation.y = (1 - t) * -Math.PI * 3 + idle.current;
    tilt.current.rotation.x = lerp(1.55, 0.78, t);
    tilt.current.rotation.z = lerp(0.6, 0.1, t);

    if (halo.current) halo.current.uniforms.uOpacity.value = t * t * (0.85 + 0.15 * Math.sin(c * 1.7));
    sparkles.current?.scale.setScalar(Math.max(t, 0.001));

    // shimmer: sweep the reflections across the metal and pass a warm glint over it
    if (!still) scene.environmentRotation.y = c * 0.35;
    if (glint.current) {
      glint.current.position.set(Math.sin(c * 0.8) * 2.6, 1.4, 2.2);
      glint.current.intensity = 14 * t;
    }
  });

  return (
    <>
      <mesh layers={1} position={[0, 0.14, -1.2]}>
        <planeGeometry args={[3.7, 3.7]} />
        <shaderMaterial ref={halo} transparent depthWrite={false} uniforms={haloUniforms} {...haloShader} />
      </mesh>
      <group ref={root}>
        <PresentationControls
          global={false}
          cursor
          snap={false}
          speed={1.6}
          polar={[-0.6, 0.7]}
          azimuth={[-Infinity, Infinity]}
          damping={0.25}
        >
          <group ref={tilt}>
            <group ref={spin} onPointerDown={() => (dragging.current = true)}>
              <DonutModel variant="gold" />
            </group>
          </group>
        </PresentationControls>
      </group>
      <pointLight ref={glint} color="#ffd9a0" distance={8} decay={2} intensity={0} />
      <group ref={sparkles}>
        <Sparkles layers={1} count={70} scale={[4.4, 2.8, 2]} size={2.6} speed={sceneState.reduced ? 0 : 0.35} color="#ffe6a6" noise={0.6} />
      </group>
      {active && (
        <ContactShadows position={[0, -1.08, 0]} opacity={0.6} scale={7.5} blur={2.6} far={3.8} resolution={256} color="#000000" />
      )}
    </>
  );
}

export function GoldDonutView({ active }: ViewProps) {
  return (
    <View className="absolute -inset-6 md:-inset-10" index={2} visible={active}>
      <Camera distance={5.9} />
      <Studio warm />
      <Suspense fallback={null}>
        <GoldDonut active={active} />
      </Suspense>
    </View>
  );
}
