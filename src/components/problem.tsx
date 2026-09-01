import { HandCoins, Hourglass, MessageCircleX } from "lucide-react";
import { Reveal } from "@/components/reveal";

const PAINS = [
  {
    icon: MessageCircleX,
    title: "Missed messages",
    body: "Tourists message you at 2 AM. If you don't reply instantly, they book with someone else.",
  },
  {
    icon: Hourglass,
    title: "Wasted time",
    body: "You spend hours every day answering the same questions about prices and times on WhatsApp.",
  },
  {
    icon: HandCoins,
    title: "Payment friction",
    body: "Chasing people down for manual bank transfers or cash deposits leads to empty seats and no-shows.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <span aria-hidden className="section-bar" />
          <h2 className="max-w-[26ch] font-display text-3xl font-semibold leading-[1.12] tracking-tight text-fg sm:text-4xl">
            Sound familiar?
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            Every business on the island hits the same three walls.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <div className="glass-slab grid grid-cols-1 overflow-hidden rounded-2xl sm:grid-cols-3">
            {PAINS.map((pain, i) => (
              <div
                key={pain.title}
                className={`group px-7 py-9 transition-colors duration-300 hover:bg-white/[0.03] ${
                  i > 0
                    ? "border-t border-edge/80 sm:border-l sm:border-t-0"
                    : ""
                }`}
              >
                <div className="flex size-11 items-center justify-center rounded-[10px] border border-line bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 group-hover:border-accent/40">
                  <pain.icon
                    className="size-5 text-accent transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="mt-5 font-display text-[17px] font-semibold text-fg">
                  {pain.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                  {pain.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
