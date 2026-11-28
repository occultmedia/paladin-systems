/*
 * The Pro badge: black with a lime label after a short lime bar, and a light
 * sweep that passes every few seconds (still when the visitor prefers reduced motion).
 * Shown wherever a Pro member sees their own account: header, account menu,
 * Settings and the Pro tab.
 */

const SIZE = {
  xs: { box: "h-[15px] gap-0.5 px-1 text-[8.5px]", icon: 8 },
  sm: { box: "h-5 gap-1 px-1.5 text-[10px]", icon: 10 },
  md: { box: "h-7 gap-1.5 px-2.5 text-[12px]", icon: 13 },
} as const;

export function ProBadge({ size = "sm", label = "Pro", className = "" }: { size?: keyof typeof SIZE; label?: string; className?: string }) {
  const s = SIZE[size];
  return (
    <span
      className={`pro-badge relative isolate inline-flex shrink-0 select-none items-center overflow-hidden rounded-full bg-zinc-950 font-display font-bold uppercase leading-none tracking-[0.14em] ring-1 ring-lime/50 ${s.box} ${className}`}
      title="Baseline Pro"
    >
      <span aria-hidden className="block h-[0.62em] w-[2px] shrink-0 bg-lime" />
      {label && <span className="text-lime">{label}</span>}
    </span>
  );
}
