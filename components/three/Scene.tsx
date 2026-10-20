"use client";

import { useProgress, View } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, type RefObject } from "react";
import { Loader } from "@/components/Loader";
import { markReady, sceneState } from "@/lib/sceneState";
import "./DonutModel"; // kicks off useGLTF.preload for all three models

/**
 * Clears the shared WebGL framebuffer once per frame right before `<View>` portals
 * (priority 1 and 2) scissor-render into it, preventing trails or rectangular clear holes
 * when scrolling up and down between sections.
 */
function FrameClear() {
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.clear(true, true, true);
  }, 0.5);
  return null;
}

/**
 * The page's only WebGL context. It is fixed at z-index 0 and comes first in the DOM, so it
 * paints over plain section backgrounds while every positioned text layer after it paints
 * on top (sections with a background must stay un-positioned for this). Every <View>
 * placed in the DOM is scissored into it. Pointer events are read from the page wrapper,
 * so the canvas itself never blocks scrolling or clicks.
 */
export default function Scene({ eventSource }: { eventSource: RefObject<HTMLElement | null> }) {
  const { active, progress, errors } = useProgress();
  const loaded = !active && progress === 100;

  useEffect(() => {
    if (!loaded) return;
    markReady();
    if (sceneState.reduced) {
      sceneState.heroGlaze = 1;
      return;
    }
    const pour = gsap.to(sceneState, { heroGlaze: 1, duration: 3.6, ease: "none", delay: 0.25 });
    return () => {
      pour.kill();
    };
  }, [loaded]);

  return (
    <>
      <Canvas
        eventSource={eventSource as RefObject<HTMLElement>}
        eventPrefix="client"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
      >
        <FrameClear />
        <View.Port />
      </Canvas>
      <Loader progress={progress} hidden={loaded} failed={errors.length > 0} />
    </>
  );
}
