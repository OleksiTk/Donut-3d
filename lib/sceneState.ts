// Mutable values shared between GSAP (DOM side) and React Three Fiber (useFrame).
// Kept outside React state on purpose: they change every frame and must not re-render.
export const sceneState = {
  /** 0 → 1: hero glaze pour, played once after the models load */
  heroGlaze: 0,
  /** 0 → 1: black frosting curtains, scrubbed by scroll */
  black: 0,
  /** 0 → 1: gold donut entrance, played once when the finale enters */
  gold: 0,
  /** prefers-reduced-motion: reduce */
  reduced: false,
  /** models loaded and the loader is fading out */
  ready: false,
};

const readyCallbacks = new Set<() => void>();

export function markReady() {
  sceneState.ready = true;
  readyCallbacks.forEach((cb) => cb());
  readyCallbacks.clear();
}

/** Runs `cb` once the models have loaded (immediately if they already have). */
export function whenReady(cb: () => void) {
  if (sceneState.ready) cb();
  else readyCallbacks.add(cb);
  return () => void readyCallbacks.delete(cb);
}
