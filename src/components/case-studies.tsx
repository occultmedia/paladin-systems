import Image from "next/image";
import terrainPhoto from "@/assets/terrain.jpg";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { TiltCard } from "@/components/tilt-card";

/* Placeholder outcomes: swap in client-verified metrics before launch. */

export function CaseStudies() {
  return (
    <section id="case-studies" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <span aria-hidden className="section-bar" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Results from the island.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            We keep client names private. The numbers are real.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
          <Reveal delay={0.1} className="md:col-span-7">
            <TiltCard className="glass-slab h-full rounded-2xl" maxTilt={4}>
              <article className="flex h-full flex-col [transform-style:preserve-3d]">
                <div className="relative h-52 overflow-hidden rounded-t-2xl border-b border-edge/70 sm:h-60">
                  <Image
                    src={terrainPhoto}
                    alt="Off-road terrain on Aruba's north coast"
                    fill
                    sizes="(min-width: 768px) 55vw, 100vw"
                    placeholder="blur"
                    className="object-cover opacity-60 grayscale"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-canvas/85 via-canvas/25 to-transparent"
                  />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-muted">
                    UTV SAFARI OPERATOR / NOORD
                  </p>
                  <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-fg">
                    Nine vehicles, one dispatcher, and a 2 AM inquiry queue that
                    used to wait for sunrise.
                  </p>
                  <div className="mt-auto flex gap-12 border-t border-edge/80 pt-6 [transform:translateZ(24px)]">
                    <div>
                      <p className="font-mono text-[22px] text-signal"><CountUp prefix="+" value={31} suffix="%" /></p>
                      <p className="mt-1 max-w-[18ch] text-[12.5px] leading-snug text-muted">
                        more bookings, won while they slept
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[22px] text-signal"><CountUp value={38} suffix=" sec" /></p>
                      <p className="mt-1 max-w-[18ch] text-[12.5px] leading-snug text-muted">
                        to reply, instead of 4 hours
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.18} className="md:col-span-5 md:translate-y-4">
            <TiltCard className="glass-slab h-full rounded-2xl" maxTilt={5}>
              <article className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <p className="font-mono text-[11px] tracking-[0.18em] text-muted">
                  PRIVATE CHARTER FLEET / PALM BEACH
                </p>
                <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-fg">
                  Sunset departures sell out by noon. Deposits now land in-chat
                  before the crew reaches the dock.
                </p>
                <div className="mt-auto flex gap-12 border-t border-edge/80 pt-6 [transform:translateZ(24px)]">
                  <div>
                    <p className="font-mono text-[22px] text-signal"><CountUp prefix="-" value={82} suffix="%" /></p>
                    <p className="mt-1 max-w-[18ch] text-[12.5px] leading-snug text-muted">
                      fewer no-shows, since deposits come first
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[22px] text-signal"><CountUp value={11} suffix=" min" /></p>
                    <p className="mt-1 max-w-[18ch] text-[12.5px] leading-snug text-muted">
                      from first question to paid booking
                    </p>
                  </div>
                </div>
              </article>
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
