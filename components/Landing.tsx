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
function useInView(ref: RefObject<HTMLElement | null>, margin = "85% 0px") {
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

          // Black: the frosting curtains follow the scrollbar, in both directions.
          // Finishes at "bottom 135%" (35svh before unsticking) so the dark cocoa pool is
          // already at full height before the section seam with #order enters or leaves the screen.
          gsap.to(sceneState, {
            black: 1,
            ease: "none",
            scrollTrigger: { trigger: black.current, start: "top 75%", end: "bottom 135%", scrub: 0.25 },
          });
          gsap.from("[data-black-copy]", {
            autoAlpha: 0,
            y: 28,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: { trigger: black.current, start: "top 35%", end: "top -10%", scrub: 0.5 },
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

      {/* Top editorial bakery bar */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-12 md:py-6">
        <a
          href="#hero-title"
          className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-crumb/12 bg-dough/85 px-4 py-2 text-xs font-semibold tracking-wider text-crumb uppercase shadow-[0_4px_20px_rgba(59,26,34,0.08)] backdrop-blur-md transition-[transform,background-color] duration-150 hover:bg-dough active:scale-[0.96] motion-reduce:transition-none"
        >
          <span className="h-2 w-2 rounded-full bg-strawberry-deep" aria-hidden="true" />
          14 Baker Lane · Craft Archive
        </a>

        <nav
          aria-label="Flavors"
          className="pointer-events-auto hidden items-center gap-1 rounded-full border border-crumb/12 bg-dough/85 p-1.5 text-xs font-semibold text-crumb shadow-[0_4px_20px_rgba(59,26,34,0.08)] backdrop-blur-md md:flex"
        >
          <a
            href="#hero-title"
            className="rounded-full px-3.5 py-1.5 transition-[background-color,color] duration-150 hover:bg-crumb/8"
          >
            01 · Strawberry
          </a>
          <a
            href="#black-section"
            className="rounded-full px-3.5 py-1.5 transition-[background-color,color] duration-150 hover:bg-crumb/8"
          >
            02 · Black Cocoa
          </a>
          <a
            href="#order"
            className="rounded-full bg-crumb px-3.5 py-1.5 text-dough transition-[transform,background-color] duration-150 hover:bg-crumb/90 active:scale-[0.96]"
          >
            03 · 23K Gold
          </a>
        </nav>
      </header>

      <section ref={hero} aria-labelledby="hero-title" className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <HeroGlazeView active={heroActive} />
        </div>

        <div className="relative z-20 mx-auto grid min-h-[100svh] max-w-[1440px] grid-cols-1 px-5 pb-10 pt-[18svh] md:grid-cols-[1fr_1.15fr] md:px-12 md:pb-14 md:pt-[9svh]">
          <div className="relative flex flex-col items-center md:col-start-2 md:row-start-1">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-crumb/15 bg-dough/75 px-3.5 py-1 text-xs font-semibold tracking-wide text-crumb/80 uppercase backdrop-blur-sm md:mb-6">
              <span>No. 01 · Morning Glaze</span>
              <span aria-hidden="true">·</span>
              <span>Poured 05:00 AM</span>
            </div>

            <h1 id="hero-title" className="display text-[clamp(6rem,31vw,9.5rem)] text-crumb md:text-[clamp(8rem,13vw,13.5rem)]">
              Donut
            </h1>

            <div className="relative -mt-2 aspect-square w-[min(84vw,44svh)] touch-pan-y md:-mt-4 md:w-[min(100%,64svh)]">
              <HeroDonutView active={heroActive} />

              {/* Floating craft callout pills around the 3D donut on desktop */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-[14%] -left-4 hidden rounded-2xl border border-crumb/12 bg-dough/88 px-3.5 py-2 text-left shadow-[0_8px_24px_rgba(59,26,34,0.08)] backdrop-blur-md lg:block"
              >
                <p className="text-[10px] font-bold tracking-wider text-strawberry-deep uppercase">Glaze Craft</p>
                <p className="text-xs font-semibold text-crumb">Wild Strawberry · 62°C</p>
              </div>

              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 bottom-[18%] hidden rounded-2xl border border-crumb/12 bg-dough/88 px-3.5 py-2 text-left shadow-[0_8px_24px_rgba(59,26,34,0.08)] backdrop-blur-md lg:block"
              >
                <p className="text-[10px] font-bold tracking-wider text-crumb/60 uppercase">Crumb</p>
                <p className="text-xs font-semibold text-crumb">48h Cold-Proof Brioche</p>
              </div>
            </div>

            {/* Interactive 360 spin cue */}
            <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-crumb/15 bg-dough/70 px-4 py-1.5 text-xs font-semibold text-crumb/80 backdrop-blur-sm">
              <svg className="h-3.5 w-3.5 text-strawberry-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Drag donut to inspect 360°</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-start gap-5 md:col-start-1 md:row-start-1 md:mt-0 md:justify-end md:gap-6 md:pb-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-strawberry-deep/12 px-3.5 py-1 text-xs font-bold tracking-wider text-strawberry-deep uppercase">
              Fresh out of the kettle · Glazed by hand
            </div>

            <p className="max-w-[28ch] text-lg leading-snug font-medium md:text-2xl md:leading-snug">
              Cold-proofed brioche ring dipped into warm Mara des Bois strawberry icing at 62°C so the glaze sets glossy and thin.
            </p>

            {/* Preparation & glaze spec grid (no prices) */}
            <dl className="grid w-full max-w-[400px] grid-cols-3 gap-2.5 rounded-2xl border border-crumb/12 bg-dough/75 p-3.5 backdrop-blur-sm">
              <div>
                <dt className="text-[11px] font-semibold tracking-wider text-crumb/60 uppercase">Dough Proof</dt>
                <dd className="mt-0.5 text-sm font-bold text-crumb tabular-nums">48h at 4°C</dd>
              </div>
              <div className="border-x border-crumb/12 px-2.5">
                <dt className="text-[11px] font-semibold tracking-wider text-crumb/60 uppercase">Glaze Base</dt>
                <dd className="mt-0.5 text-sm font-bold text-crumb">Mara des Bois</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-wider text-crumb/60 uppercase">Pour Temp</dt>
                <dd className="mt-0.5 text-sm font-bold text-crumb tabular-nums">62°C Warm</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#black-section"
                className="inline-flex h-14 items-center gap-2.5 rounded-full bg-crumb px-8 text-lg font-semibold text-dough shadow-[0_10px_28px_rgba(59,26,34,0.22)] transition-[transform,background-color] duration-150 hover:-translate-y-0.5 active:scale-[0.96] motion-reduce:transition-none"
              >
                <span>Explore glazes</span>
                <span aria-hidden="true" className="text-dough/70">↓</span>
              </a>
              <a
                href="#order"
                className="inline-flex h-14 items-center rounded-full border border-crumb/20 bg-dough/60 px-6 text-base font-semibold text-crumb backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-crumb/8 active:scale-[0.96] motion-reduce:transition-none"
              >
                03 · 23K Gold craft →
              </a>
            </div>
          </div>
        </div>
        <p className="sr-only">Drag the donut to turn it.</p>
      </section>

      {/* Tall track; stays un-positioned so its bottom --licorice floor sits behind the fixed Canvas (z-index 0)
          and bridges the seam into #order on the native scroll compositor without ever flashing --dough */}
      <section
        ref={black}
        id="black-section"
        aria-labelledby="black-title"
        className="h-[275svh]"
        style={{
          background: "linear-gradient(to bottom, transparent calc(100% - 24svh), var(--licorice) calc(100% - 24svh))",
        }}
      >
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div className="absolute inset-0" aria-hidden="true">
            <BlackDripsView active={blackActive} />
          </div>
          <div className="relative z-20 mx-auto flex h-full max-w-[1440px] flex-col items-center px-6 pt-[10svh] text-center md:px-12">
            <div
              data-black-copy
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-crumb/15 bg-dough/80 px-4 py-1 text-xs font-bold tracking-wider text-crumb uppercase backdrop-blur-sm md:mb-6"
            >
              No. 02 · Evening Roast · 72% Single-Origin
            </div>
            <h2 id="black-title" data-black-copy className="display text-[clamp(4.25rem,16vw,10rem)] text-crumb">
              Black cocoa
            </h2>
            <p data-black-copy className="mt-4 max-w-[36ch] text-lg leading-snug font-medium md:text-xl md:leading-snug">
              Dark cocoa glaze, toasted black sesame and a pinch of sea salt. Tempered in small copper bowls for a mirror sheen.
            </p>
            <div data-black-copy className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-crumb/15 bg-dough/80 px-3.5 py-1 text-xs font-semibold text-crumb backdrop-blur-sm">
                Dutch-Process Alkalized Cocoa
              </span>
              <span className="rounded-full border border-crumb/15 bg-dough/80 px-3.5 py-1 text-xs font-semibold text-crumb backdrop-blur-sm">
                Black Sesame Praline
              </span>
              <span className="rounded-full border border-crumb/15 bg-dough/80 px-3.5 py-1 text-xs font-semibold text-crumb backdrop-blur-sm">
                Flaky Maldon Salt
              </span>
            </div>
            <div className="relative mt-[1.5svh] aspect-square w-[min(78vw,46svh)]" aria-hidden="true">
              <BlackDonutView active={blackActive} />
            </div>
          </div>
        </div>
      </section>

      <section ref={gold} id="order" aria-labelledby="gold-title" className="on-dark bg-licorice text-gilt-light">
        <div className="relative z-20 mx-auto flex min-h-[100svh] max-w-[1200px] flex-col items-center px-6 pb-16 pt-[6svh] text-center">
          <div className="relative aspect-[5/4] w-[min(96vw,780px,78svh)]" aria-hidden="true">
            <GoldDonutView active={goldActive} />
          </div>

          <div
            data-gold-copy
            className="mt-2 mb-6 inline-flex items-center gap-2.5 rounded-full border border-gilt/30 bg-gilt/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-gilt-light uppercase md:mb-8"
          >
            <span className="h-2 w-2 rounded-full bg-gilt" aria-hidden="true" />
            No. 03 · Artisan Finishing · Brown-Butter &amp; Gold Leaf
          </div>

          <h2 id="gold-title" data-gold-copy className="gold-type display text-[clamp(4.25rem,15vw,10.5rem)]">
            The gold one
          </h2>
          <p data-gold-copy className="mt-5 max-w-[40ch] text-lg leading-relaxed text-gilt-light/85 md:text-xl md:leading-relaxed">
            Warm Normandy brown-butter and wildflower honey glaze, rested on wire racks and dressed by hand with sheets of 23-carat edible gold leaf.
          </p>

          {/* Craft ingredient pills instead of price buttons */}
          <div data-gold-copy className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <span className="rounded-full border border-gilt/30 bg-gilt/10 px-4 py-1.5 text-xs font-semibold text-gilt-light">
              Normandy Beurre Noisette
            </span>
            <span className="rounded-full border border-gilt/30 bg-gilt/10 px-4 py-1.5 text-xs font-semibold text-gilt-light">
              Raw Linden Blossom Honey
            </span>
            <span className="rounded-full border border-gilt/30 bg-gilt/10 px-4 py-1.5 text-xs font-semibold text-gilt-light">
              23-Carat Edible Gold Leaf
            </span>
          </div>

          {/* Glaze & Preparation Breakdown Cards (replacing price menu cards) */}
          <div data-gold-copy className="mt-14 grid w-full max-w-[1020px] grid-cols-1 gap-4 text-left md:grid-cols-3">
            <div className="flex flex-col justify-between rounded-3xl border border-gilt/20 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-gilt/80 uppercase">
                  <span>01 · Morning Glaze</span>
                  <span className="tabular-nums">62°C POUR</span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-gilt-light">Wild Strawberry</h3>
                <p className="mt-2 text-sm leading-relaxed text-gilt-light/70">
                  Crushed Mara des Bois berries reduced with cane sugar and folded into whipped icing. Dipped while the 48-hour cold-proofed brioche is still warm from the kettle.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-gilt/15 pt-4 text-xs font-semibold text-gilt/80">
                <span>Glaze: Berry Reduction</span>
                <span>Crumb: Brioche</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-gilt/40 bg-gilt/[0.08] p-6 backdrop-blur-sm">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-gilt uppercase">
                  <span>02 · Evening Roast</span>
                  <span className="tabular-nums">72% COCOA</span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-gilt-light">Black Cocoa &amp; Sesame</h3>
                <p className="mt-2 text-sm leading-relaxed text-gilt-light/75">
                  Dutch-process alkalized cocoa whisked with cocoa butter, roasted black sesame praline, and finished with a pinch of flaky Maldon sea salt as the glaze sets.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-gilt/25 pt-4 text-xs font-semibold text-gilt">
                <span>Glaze: Tempered Ganache</span>
                <span>Finish: Sesame &amp; Salt</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-gilt/20 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-gilt/80 uppercase">
                  <span>03 · Gilded Finale</span>
                  <span className="tabular-nums">23K LEAF</span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-gilt-light">Honey-Butter Gold</h3>
                <p className="mt-2 text-sm leading-relaxed text-gilt-light/70">
                  Caramelized Normandy brown butter emulsified with raw wildflower honey into a translucent amber glaze, then layered with delicate 23-carat gold leaf using bamboo tongs.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-gilt/15 pt-4 text-xs font-semibold text-gilt/80">
                <span>Glaze: Beurre Noisette</span>
                <span>Finish: 23K Gold Foil</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="relative z-20 mx-auto flex max-w-[1200px] flex-col gap-2 border-t border-gilt/15 px-6 py-8 text-sm text-gilt-light/60 sm:flex-row sm:justify-between">
          <p>14 Baker Lane · Small-batch brioche rings · Cold-proofed for 48 hours.</p>
          <p>Hand-glazed in copper kettles since 2019.</p>
        </footer>
      </section>
    </div>
  );
}
