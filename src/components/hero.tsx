"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BedDouble,
  Building2,
  Car,
  Home,
  Map,
  Plus,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { ChatPlayer, type ChatStep } from "@/components/chat-player";
import { CountUp } from "@/components/count-up";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Placeholder track-record figures: confirm real numbers before launch. */
const METRICS = [
  { value: 3500, suffix: "+", label: "bookings processed" },
  { value: 10000, suffix: "+", label: "customer conversations" },
  { value: 38, suffix: " sec", label: "average first reply" },
];

const INDUSTRIES = [
  { icon: Building2, label: "Real Estate" },
  { icon: Home, label: "Airbnbs" },
  { icon: Car, label: "Car Rentals" },
  { icon: BedDouble, label: "Boutique Hotels" },
  { icon: Map, label: "Tour Operators" },
  { icon: Waves, label: "Watersports" },
  { icon: UtensilsCrossed, label: "Restaurants" },
];

const TOUR_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Hi! Do you have a jeep tour tomorrow morning? We're 4 people",
  },
  {
    kind: "out",
    text: "We do! The 9 AM tour has 4 spots left. $89 per person. Want me to hold them?",
  },
  {
    kind: "out",
    text: "Here's your secure link to pay the $50 deposit:",
    link: "Secure payment link",
  },
  { kind: "status", text: "Deposit received. See you at 9 AM!" },
];

const REALTY_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Is the 2-bedroom apartment in Noord still available?",
  },
  {
    kind: "action",
    pending: "Checking current listings",
    done: "2BR Noord: available",
  },
  {
    kind: "out",
    text: "It is! Want to see it? Thursday at 3 PM is open for a viewing.",
  },
  { kind: "status", text: "Viewing confirmed for Thursday 3 PM." },
];

export function Hero() {
  const reduce = useReducedMotion();

  /* Slide-only entrance: text stays visible in server HTML (no opacity: 0
     before hydration), which keeps LCP at first paint on slow connections. */
  const rise = (delay: number) => ({
    initial: reduce ? false : { y: 26 },
    animate: { y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  });

  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[640px] rounded-full bg-[radial-gradient(closest-side,var(--halo-soft),transparent)] blur-2xl"
      />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-[1400px] grid-cols-1 items-center gap-y-10 px-5 pb-8 pt-32 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-8 lg:px-8 lg:pb-8 lg:pt-20">
        <div className="lg:col-span-7">
          <motion.p
            {...rise(0)}
            className="font-mono text-[11.5px] uppercase tracking-[0.26em] text-muted"
          >
            Boutique AI integration for Aruban businesses
          </motion.p>

          <motion.h1
            {...rise(0.08)}
            className="mt-7 font-display text-[clamp(38px,5.5vw,75px)] font-bold uppercase leading-[1.02] tracking-[-0.02em] text-fg"
          >
            Never miss
            <br className="hidden md:block" />{" "}
            <span className="bg-gradient-to-r from-fg via-accent to-muted bg-clip-text text-transparent">
              another booking.
            </span>
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-7 max-w-[56ch] text-base leading-relaxed text-muted lg:text-[18px]"
          >
            We install automated booking systems on your website and WhatsApp.
            While you run your business (or sleep), our system answers customer
            questions, checks your availability, and sends secure payment links
            to collect deposits 24/7.
          </motion.p>

          <motion.div
            {...rise(0.24)}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <a
              href="#how-it-works"
              className="btn-metal rounded-[10px] px-7 py-4 font-mono text-[13.5px] font-medium uppercase tracking-[0.08em] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              See How It Works
            </a>
          </motion.div>

          <motion.div
            {...rise(0.32)}
            className="mt-12 flex flex-wrap gap-x-12 gap-y-6"
          >
            {METRICS.map((metric) => (
              <div key={metric.label}>
                <p className="font-mono text-[24px] text-fg">
                  <CountUp value={metric.value} suffix={metric.suffix} />
                </p>
                <p className="mt-1 text-[12.5px] text-muted">{metric.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          {...rise(0.3)}
          className="flex flex-col gap-5 lg:col-span-5"
        >
          <ChatPlayer
            chrome="whatsapp"
            script={TOUR_SCRIPT}
            title="Your Tour Company"
            subtitle="online, replies in seconds"
            time="2:14 AM"
            bodyClassName="h-[368px] sm:h-[308px]"
            className="lg:-translate-x-3"
            srDescription="Example WhatsApp conversation: a customer asks about a jeep tour at 2:14 AM, the Agent confirms availability and price, sends a secure payment link, and the deposit is received."
          />
          <ChatPlayer
            chrome="widget"
            script={REALTY_SCRIPT}
            title="Chat with us"
            subtitle="replies instantly, day and night"
            domain="your-realty.aw"
            bodyClassName="h-[332px] sm:h-[264px]"
            className="lg:translate-x-3"
            srDescription="Example website chat for a real estate office: a customer asks if a 2-bedroom apartment in Noord is available, the Agent checks the listings, offers a Thursday 3 PM viewing, and the viewing is confirmed."
          />
        </motion.div>

        <motion.div {...rise(0.4)} className="lg:col-span-12">
          <div className="relative pt-7">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-edge to-transparent"
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">
              Industries we work with
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {INDUSTRIES.map((industry) => (
                <div
                  key={industry.label}
                  className="group flex items-center gap-3.5 rounded-2xl border border-edge bg-surface/60 py-3.5 pl-4 pr-5 transition-colors duration-300 hover:border-line hover:bg-white/[0.03]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line/80 bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <industry.icon
                      className="size-4 text-accent transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                  </span>
                  <span className="text-[14.5px] font-medium text-fg">
                    {industry.label}
                  </span>
                </div>
              ))}
              <a
                href="#audit"
                className="group flex items-center gap-3.5 rounded-2xl border border-accent/35 bg-surface/60 py-3.5 pl-4 pr-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/70"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-accent/40 bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <Plus className="size-4 text-accent" strokeWidth={1.5} />
                </span>
                <span className="text-[14.5px] font-medium text-accent">
                  Your Business
                </span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
