"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageCircle,
  Palette,
  Rocket,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { TiltCard } from "@/components/tilt-card";

function Connector() {
  const reduce = useReducedMotion();

  return (
    <div className="flex items-center justify-center py-1 md:py-0">
      <span className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-surface/90 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)] backdrop-blur-sm">
        <motion.span
          className="hidden md:block"
          animate={reduce ? undefined : { x: [0, 3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
        >
          <ArrowRight className="size-4 text-accent" strokeWidth={1.5} />
        </motion.span>
        <ArrowDown className="size-4 text-accent md:hidden" strokeWidth={1.5} />
      </span>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            How it works.
          </h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            <span className="text-fg">Website first. Agent second.</span> We
            design and launch a site built around how your business actually
            works. Then, if you want it, we add an AI Agent that answers
            customers and closes bookings on its own.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3">
            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <Palette className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  We design your website
                </h3>
                <div className="mt-4 self-start rounded-full border border-edge bg-canvas px-4 py-2 font-mono text-[12.5px] tracking-[0.06em] text-fg [transform:translateZ(16px)]">
                  your-business.aw
                </div>
                <p className="mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                  YOUR BRAND / YOUR STORY
                </p>
              </div>
            </TiltCard>

            <Connector />

            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <Rocket className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  We build it and launch it
                </h3>
                <div className="mt-4 self-end rounded-2xl rounded-br-[6px] border border-accent/25 bg-accent/10 px-4 py-2.5 text-[13.5px] leading-snug text-fg [transform:translateZ(16px)]">
                  Live in 14 days
                </div>
                <p className="mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                  FAST / MOBILE-FIRST / FOUND ON GOOGLE
                </p>
              </div>
            </TiltCard>

            <Connector />

            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <MessageCircle className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  The plus: your AI Agent
                </h3>
                <div className="mt-4 self-start rounded-[10px] border border-edge bg-canvas px-4 py-2.5 [transform:translateZ(16px)]">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                    <Lock className="size-3.5 text-accent" strokeWidth={1.5} />
                    Secure payment link
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-signal">
                    <CheckCircle2 className="size-3.5" strokeWidth={2} />
                    Deposit received
                  </p>
                </div>
                <p className="mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                  OPTIONAL / WHATSAPP + YOUR WEBSITE
                </p>
              </div>
            </TiltCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
