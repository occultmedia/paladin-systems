"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Lock,
  MessageCircle,
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
            <span className="text-fg">
              Not a chatbot that answers FAQ questions.
            </span>{" "}
            It&apos;s a receptionist who never sleeps: it knows your prices and
            rules, checks your real calendar, and closes the booking itself.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3">
            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <MessageCircle className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  Tourist asks a question
                </h3>
                <div className="mt-4 max-w-[26ch] self-start rounded-2xl rounded-bl-[6px] border border-edge bg-canvas px-4 py-2.5 text-[13.5px] leading-snug text-fg [transform:translateZ(16px)]">
                  Can I book a Jeep for tomorrow?
                </div>
                <p className="mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                  WHATSAPP / YOUR WEBSITE
                </p>
              </div>
            </TiltCard>

            <Connector />

            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <CalendarCheck className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  Paladin checks your schedule
                </h3>
                <div className="mt-4 max-w-[26ch] self-end rounded-2xl rounded-br-[6px] border border-accent/25 bg-accent/10 px-4 py-2.5 text-[13.5px] leading-snug text-fg [transform:translateZ(16px)]">
                  Yes, we have 2 left!
                </div>
                <p className="mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                  LIVE AVAILABILITY / GOOGLE CALENDAR
                </p>
              </div>
            </TiltCard>

            <Connector />

            <TiltCard className="glass-slab rounded-2xl" maxTilt={5}>
              <div className="flex h-full flex-col p-7 [transform-style:preserve-3d]">
                <div className="[transform:translateZ(26px)]">
                  <CreditCard className="size-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-fg">
                  You get paid
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
                  CREDIT CARD DEPOSITS / LOCAL BANKS
                </p>
              </div>
            </TiltCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
