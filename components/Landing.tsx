"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader } from "@/components/Loader";
import { sceneState, whenReady } from "@/lib/sceneState";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Everything WebGL is client-only; the HTML around it still renders on the server.
const Scene = dynamic(() => import("./three/Scene"), {
  ssr: false,
  loading: () => <Loader progress={0} />,
});
const HeroGlazeView = dynamic(() => import("./three/views").then((m) => m.HeroGlazeView), { ssr: false });
const HeroDonutView = dynamic(() => import("./three/views").then((m) => m.HeroDonutView), { ssr: false });
const BlackDripsView = dynamic(() => import("./three/views").then((m) => m.BlackDripsView), { ssr: false });
const BlackDonutView = dynamic(() => import("./three/views").then((m) => m.BlackDonutView), { ssr: false });
const GoldDonutView = dynamic(() => import("./three/views").then((m) => m.GoldDonutView), { ssr: false });

/** True while the element is on (or near) the screen; inactive views skip their frame work. */
function useInView(ref: RefObject<HTMLElement | null>, margin = "15% 0px") {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const black = useRef<HTMLElement>(null);
  const gold = useRef<HTMLElement>(null);
  const heroActive = useInView(hero);
  const blackActive = useInView(black);
  const goldActive = useInView(gold);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" },
        (ctx) => {
          const reduce = Boolean(ctx.conditions?.reduce);
          sceneState.reduced = reduce;

          if (reduce) {
            // everything in its finished state, nothing moves on its own
            sceneState.black = 1;
            sceneState.gold = 1;
            return;
          }

          // Black: the frosting curtains follow the scrollbar, in both directions
          gsap.to(sceneState, {
            black: 1,
            ease: "none",
            scrollTrigger: { trigger: black.current, start: "top 75%", end: "bottom bottom", scrub: 0.7 },
          });
          gsap.from("[data-black-copy]", {
            autoAlpha: 0,
            y: 28,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: { trigger: black.current, start: "top 35%", end: "top -10%", scrub: 0.7 },
          });

          // Gold: one orchestrated entrance, played once. Built up front (so the context
          // reverts it) and held until the models are in, so it never plays behind the loader.
          const entrance = gsap
            .timeline({ paused: true })
            .to(sceneState, { gold: 1, duration: 2.8, ease: "power3.out" })
            .from("[data-gold-copy]", { autoAlpha: 0, y: 32, duration: 1, stagger: 0.12, ease: "power2.out" }, 1.3);
          let cancelWait = () => {};
          ScrollTrigger.create({
            trigger: gold.current,
            start: "top 60%",
            once: true,
            onEnter: () => {
              cancelWait = whenReady(() => entrance.play());
            },
          });

          return () => {
            cancelWait();
            sceneState.black = 0;
            sceneState.gold = 0;
          };
        },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative">
      <Scene eventSource={root} />

      <section ref={hero} aria-labelledby="hero-title" className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <HeroGlazeView active={heroActive} />
        </div>

        <div className="relative z-20 mx-auto grid min-h-[100svh] max-w-[1440px] grid-cols-1 px-5 pb-8 pt-[19svh] md:grid-cols-[1fr_1.1fr] md:px-12 md:pb-14 md:pt-[7svh]">
          <div className="flex flex-col items-center md:col-start-2 md:row-start-1">
            <h1 id="hero-title" className="display text-[clamp(6rem,31vw,9.5rem)] text-crumb md:text-[clamp(8rem,13vw,13.5rem)]">
              Donut
            </h1>
            <div className="relative -mt-2 aspect-square w-[min(84vw,44svh)] touch-pan-y md:-mt-4 md:w-[min(100%,66svh)]">
              <HeroDonutView active={heroActive} />
            </div>
          </div>

          <div className="mt-2 flex flex-col items-start gap-5 md:col-start-1 md:row-start-1 md:mt-0 md:justify-end md:gap-6 md:pb-2">
            <p className="max-w-[28ch] text-lg leading-snug md:text-2xl md:leading-snug">
              Strawberry glaze, poured by hand at five every morning. Still warm at eight.
            </p>
            <a
              href="#order"
              className="inline-flex h-14 items-center rounded-full bg-crumb px-8 text-lg font-semibold text-dough transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none"
            >
              Order a box
            </a>
          </div>
        </div>
        <p className="sr-only">Drag the donut to turn it.</p>
      </section>

      {/* Tall track; the inner frame sticks while the frosting runs down */}
      <section ref={black} aria-labelledby="black-title" className="relative h-[260svh]">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div className="absolute inset-0" aria-hidden="true">
            <BlackDripsView active={blackActive} />
          </div>
          <div className="relative z-20 mx-auto flex h-full max-w-[1440px] flex-col items-center px-12 pt-[11svh] text-center">
            <h2 id="black-title" data-black-copy className="display text-[clamp(4.25rem,16vw,10rem)] text-crumb">
              Black cocoa
            </h2>
            <p data-black-copy className="mt-5 max-w-[34ch] text-lg leading-snug md:text-xl md:leading-snug">
              Dark cocoa glaze, toasted black sesame and a pinch of sea salt. Bitter first, sweet after.
            </p>
            <div className="relative mt-[2svh] aspect-square w-[min(80vw,50svh)]" aria-hidden="true">
              <BlackDonutView active={blackActive} />
            </div>
          </div>
        </div>
      </section>

      <section ref={gold} id="order" aria-labelledby="gold-title" className="on-dark bg-licorice text-gilt-light">
        <div className="relative z-20 mx-auto flex min-h-[100svh] max-w-[1200px] flex-col items-center px-6 pb-16 pt-[6svh] text-center">
          <div className="relative aspect-[5/4] w-[min(96vw,780px,82svh)]" aria-hidden="true">
            <GoldDonutView active={goldActive} />
          </div>
          <h2 id="gold-title" data-gold-copy className="gold-type display -mt-[4svh] text-[clamp(4.25rem,15vw,10.5rem)]">
            The gold one
          </h2>
          <p data-gold-copy className="mt-6 max-w-[36ch] text-lg leading-relaxed text-gilt-light/85 md:text-xl md:leading-relaxed">
            Honey-butter glaze under a leaf of 23-carat gold. We make twelve a day and stop when they&apos;re gone.
          </p>
          <div data-gold-copy className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <a
              href="mailto:hello@donut.example?subject=Gold%20donut"
              className="inline-flex h-14 items-center rounded-full bg-gilt px-8 text-lg font-semibold text-licorice transition-colors hover:bg-gilt-light motion-reduce:transition-none"
            >
              Reserve a gold one
            </a>
            <a href="mailto:hello@donut.example?subject=Box%20order" className="text-lg underline decoration-gilt/50 underline-offset-[6px] hover:decoration-gilt">
              Order a box of twelve
            </a>
          </div>
        </div>
        <footer className="relative z-20 mx-auto flex max-w-[1200px] flex-col gap-2 px-6 pb-10 text-sm text-gilt-light/60 sm:flex-row sm:justify-between">
          <p>14 Baker Lane. Open Tuesday to Sunday from 7, until we sell out.</p>
          <p>Glazed by hand since 2019.</p>
        </footer>
      </section>
    </div>
  );
}
