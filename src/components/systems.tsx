"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  FileSignature,
  IdCard,
  Languages,
  MessageCircle,
  SearchCheck,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { CONTACT_EMAIL } from "@/lib/site";

/* Product-card palette: charcoal modules lifted just above the page black,
   with silver accents. Local to the hardware catalog. */
const CARD = {
  bg: "#101013",
  edge: "#2a2a2f",
  name: "#f5f6f7",
  body: "#9a9ca3",
  spec: "#c6c9cf",
  faint: "#8a8d94",
  bone: "#e9ebf0",
};

type Product = {
  target: string;
  name: string;
  pitch: string;
  hero: LucideIcon;
  specs: { icon: LucideIcon; text: string }[];
};

const PRODUCTS: Product[] = [
  {
    target: "For tour operators, charters + car rentals",
    name: "The 24/7 Booking Engine",
    pitch: "Turns your WhatsApp into an automatic cash register.",
    hero: Zap,
    specs: [
      { icon: MessageCircle, text: "Answers customer FAQs instantly." },
      {
        icon: CalendarCheck,
        text: "Checks your live calendar to prevent double-booking.",
      },
      {
        icon: CreditCard,
        text: "Generates secure local payment links to collect deposits.",
      },
    ],
  },
  {
    target: "For boutique hotels, villas + Airbnbs",
    name: "The Digital Concierge",
    pitch: "5-star guest support in 4 languages, while your staff sleeps.",
    hero: ConciergeBell,
    specs: [
      {
        icon: Languages,
        text: "Fluent in English, Spanish, Dutch, and Papiamento.",
      },
      { icon: Wifi, text: "Answers Wi-Fi, AC, and local restaurant questions." },
      {
        icon: Wrench,
        text: "Automatically routes maintenance tickets to your staff.",
      },
    ],
  },
  {
    target: "For high-volume excursions (UTVs, catamarans)",
    name: "The Operations Dispatcher",
    pitch: "Zero lines at your front desk. Guests arrive ready to go.",
    hero: ClipboardCheck,
    specs: [
      {
        icon: IdCard,
        text: "Chases down customers on WhatsApp for driver's licenses.",
      },
      {
        icon: FileSignature,
        text: "Collects digital liability waivers before arrival.",
      },
      {
        icon: ClipboardList,
        text: "Automatically updates your morning guest manifest.",
      },
    ],
  },
];

function ProductCard({ product }: { product: Product }) {
  const reduce = useReducedMotion();
  const Hero = product.hero;

  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{ backgroundColor: CARD.bg, borderColor: CARD.edge }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_18px_44px_-22px_rgba(0,0,0,0.6)] transition-[border-color,box-shadow] duration-300 hover:border-white/40 hover:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.7),0_0_32px_-8px_rgba(233,235,240,0.28)]"
    >
      {/* product stage */}
      <div
        className="relative h-32 shrink-0 overflow-hidden border-b"
        style={{ borderColor: CARD.edge }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:radial-gradient(ellipse_at_50%_50%,black_0%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-28 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.11),transparent)] blur-md"
        />
        <div className="relative flex h-full items-center justify-center">
          <div className="flex size-14 items-center justify-center rounded-[10px] border border-[#333338] bg-[#17171a] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Hero className="size-6" style={{ color: CARD.bone }} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: CARD.faint }}
        >
          {product.target}
        </p>
        <h3
          className="mt-3 font-display text-xl font-semibold"
          style={{ color: CARD.name }}
        >
          {product.name}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: CARD.body }}>
          {product.pitch}
        </p>

        <ul className="mt-5 space-y-3">
          {product.specs.map((spec) => (
            <li key={spec.text} className="flex items-start gap-3">
              <spec.icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: CARD.bone }}
                strokeWidth={1.5}
              />
              <span
                className="font-mono text-[12px] leading-relaxed"
                style={{ color: CARD.spec }}
              >
                {spec.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <div className="border-t pt-5" style={{ borderColor: CARD.edge }}>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                `Order: ${product.name}`,
              )}`}
              className="btn-hardware block w-full rounded-[10px] py-3 text-center font-mono text-[12.5px] font-medium uppercase tracking-[0.08em] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            >
              Order This Agent
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function Systems() {
  return (
    <section id="systems" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Pick your Agent.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            Three ready-made Agents, each custom-tuned to your business. Same
            simple pricing for all of them.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRODUCTS.map((product, i) => (
            <Reveal key={product.name} delay={0.08 * i} className="h-full">
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12} className="mt-10">
          <div className="glass-slab grid grid-cols-1 rounded-2xl sm:grid-cols-3">
            <div className="px-7 py-8">
              <p className="font-mono text-[26px] text-fg"><CountUp prefix="$" value={1500} /></p>
              <p className="mt-2 max-w-[26ch] text-[13.5px] leading-relaxed text-muted">
                one-time base installation, any Agent
              </p>
            </div>
            <div className="border-t border-edge/80 px-7 py-8 sm:border-l sm:border-t-0">
              <p className="font-mono text-[26px] text-fg"><CountUp prefix="From $" value={200} suffix="/mo" /></p>
              <p className="mt-2 max-w-[26ch] text-[13.5px] leading-relaxed text-muted">
                monthly maintenance and AI usage, sized to your traffic
              </p>
            </div>
            <div className="border-t border-edge/80 px-7 py-8 sm:border-l sm:border-t-0">
              <p className="font-mono text-[26px] text-fg">+ Custom</p>
              <p className="mt-2 max-w-[26ch] text-[13.5px] leading-relaxed text-muted">
                special features quoted on top, one fixed price
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-[74ch] text-[13.5px] leading-relaxed text-muted">
            The monthly fee depends on the size of your website and how many
            visitors your Agent talks to: busier businesses use more AI. We
            agree the exact number with you up front, before anything goes
            live.
          </p>
        </Reveal>

        <Reveal delay={0.14} className="mt-6">
          <div className="glass-slab flex flex-col gap-5 rounded-2xl p-7 md:flex-row md:items-center md:gap-7">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <SearchCheck className="size-5 text-accent" strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[17px] font-semibold text-fg">
                Booking Flow Audit + Conversion Consultation
              </h3>
              <p className="mt-1.5 max-w-[72ch] text-[14px] leading-relaxed text-muted">
                We audit how customers book with you today, find where
                inquiries leak, and show you how to turn more of them into
                paid bookings. Also available on its own.
              </p>
            </div>
            <a
              href="#audit"
              className="shrink-0 font-medium text-accent underline-offset-4 hover:underline"
            >
              Get a Free Quote
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.18} className="mt-16">
          <div className="relative pt-12">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-edge to-transparent"
            />
            <p className="max-w-[32ch] font-display text-[clamp(22px,2.6vw,34px)] font-semibold leading-[1.22] tracking-tight text-fg">
              If customers message you to book, ask, or order, we can
              custom-build an Agent for it.
            </p>
            <a
              href="#audit"
              className="group mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-accent transition-colors hover:text-fg"
            >
              Tell us what you do
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
