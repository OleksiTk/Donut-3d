/** Pure markup so it can render on the server before any 3D code arrives. */
export function Loader({ progress, hidden = false, failed = false }: { progress: number; hidden?: boolean; failed?: boolean }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={hidden}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-dough transition-opacity duration-700 motion-reduce:transition-none ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--crumb)" strokeOpacity="0.12" strokeWidth="14" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--strawberry)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 300ms ease-out" }}
        />
      </svg>
      <p className="text-base text-crumb">
        {failed ? "The donuts didn't load. Reload the page to try again." : `Glazing… ${Math.round(progress)}%`}
      </p>
    </div>
  );
}
