import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

const STEPS = ["Free call", "We build your Agent", "You test it", "Live in 14 days"];

export function AuditCta() {
  return (
    <section id="audit" className="relative scroll-mt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[15%] top-6 h-48 rounded-full bg-[radial-gradient(closest-side,var(--halo-strong),transparent)] blur-3xl"
      />
      <div className="relative mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <div className="glass-slab grid grid-cols-1 items-center gap-8 rounded-2xl p-8 sm:p-10 lg:grid-cols-12 lg:p-14">
            <div className="lg:col-span-8">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Get a free quote.
              </h2>
              <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
                Tell us how bookings happen today. We&apos;ll audit your
                booking flow, show you where you&apos;re losing bookings and
                what an Agent would take over, then quote one fixed price.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                {STEPS.map((step, i) => (
                  <span key={step} className="flex items-center gap-x-2.5">
                    {i > 0 && (
                      <ArrowRight
                        aria-hidden
                        className="size-3.5 text-muted"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="rounded-[10px] border border-edge/80 bg-canvas/50 px-3 py-1.5 text-[12.5px] font-medium text-fg">
                      {step}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              {/* Replace with the client's real intake address before launch. */}
              <a
                href="mailto:ops@paladinsystems.aw?subject=Free%20Quote"
                className="btn-metal inline-block rounded-[10px] px-7 py-4 font-mono text-[13px] font-medium uppercase tracking-[0.08em] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Get a Free Quote
              </a>
              <p className="mt-3 font-mono text-[11px] text-muted">
                ops@paladinsystems.aw
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
