"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Layers,
  MessageCircle,
  PencilRuler,
  PhoneCall,
  RefreshCw,
  Search,
  SearchCheck,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { CONTACT_EMAIL } from "@/lib/site";

type Plan = {
  target: string;
  name: string;
  price?: number;
  priceLabel?: string;
  pitch: string;
  hero: LucideIcon;
  features: { icon: LucideIcon; text: string }[];
  cta: string;
  featured?: boolean;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    target: "For companies that need a solid site, handled",
    name: "Starter",
    price: 250,
    pitch: "We build your website, then keep it healthy month after month.",
    hero: PencilRuler,
    features: [
      { icon: PencilRuler, text: "We design and build your website." },
      { icon: Wrench, text: "Basic maintenance, covered every month." },
      {
        icon: MessageCircle,
        text: "Small site changes here and there, on request.",
      },
    ],
    cta: "Start with Starter",
  },
  {
    target: "For companies that want to grow, not just exist",
    name: "Pro",
    price: 500,
    pitch: "Everything in Starter, plus someone actively growing your site.",
    hero: TrendingUp,
    features: [
      {
        icon: Search,
        text: "SEO + GEO: found on Google and recommended by AI assistants.",
      },
      {
        icon: BarChart3,
        text: "Google Analytics report in your inbox, every month.",
      },
      {
        icon: RefreshCw,
        text: "Monthly content changes: pages, photos, promotions.",
      },
    ],
    cta: "Go Pro",
    featured: true,
    badge: "All in one",
  },
  {
    target: "For hotels, groups + bigger operations",
    name: "Enterprise",
    priceLabel: "Let's talk",
    pitch: "A plan shaped around your business, not picked from a menu.",
    hero: Layers,
    features: [
      { icon: Bot, text: "AI agents, bookings + custom integrations." },
      { icon: Layers, text: "Multiple sites, brands, or languages." },
      { icon: PhoneCall, text: "Priority support with a direct line." },
    ],
    cta: "Book a call",
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const reduce = useReducedMotion();
  const Hero = plan.hero;

  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`glass-slab relative flex h-full flex-col overflow-hidden rounded-2xl transition-[border-color] duration-300 ${
        plan.featured
          ? "border-signal/50 hover:border-signal/80"
          : "hover:border-signal/50"
      }`}
    >
      {plan.badge && (
        <span className="absolute right-4 top-4 z-10 rounded-full bg-brand px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#101403]">
          {plan.badge}
        </span>
      )}

      {/* plan stage */}
      <div className="relative h-32 shrink-0 overflow-hidden border-b border-edge/80">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:radial-gradient(ellipse_at_50%_50%,black_0%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-28 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--halo-strong),transparent)] blur-md"
        />
        <div className="relative flex h-full items-center justify-center">
          <div className="flex size-14 items-center justify-center rounded-[10px] border border-line bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Hero className="size-6 text-accent" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {plan.target}
        </p>
        <h3 className="mt-3 font-display text-xl font-semibold text-fg">
          {plan.name}
        </h3>
        <p className="mt-2 font-mono text-[26px] text-signal">
          {plan.price ? (
            <>
              <CountUp prefix="Afl. " value={plan.price} />
              <span className="text-[14px] text-muted">/month</span>
            </>
          ) : (
            plan.priceLabel
          )}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {plan.pitch}
        </p>

        <ul className="mt-5 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-3">
              <feature.icon
                className="mt-0.5 size-4 shrink-0 text-accent"
                strokeWidth={1.5}
              />
              <span className="font-mono text-[12px] leading-relaxed text-muted">
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <div className="border-t border-edge/80 pt-5">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                `Plan: ${plan.name}`,
              )}`}
              className="btn-metal block w-full rounded-[10px] py-3 text-center font-mono text-[12.5px] font-medium uppercase tracking-[0.08em] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {plan.cta}
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
          <span aria-hidden className="section-bar" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Pick your plan.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            One flat monthly price. No hourly rates, no surprise invoices:
            the build, the maintenance, and the growth are all inside the
            plan.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={0.08 * i} className="h-full">
              <PlanCard plan={plan} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12} className="mt-6">
          <p className="max-w-[74ch] text-[13.5px] leading-relaxed text-muted">
            Prices are in Aruban florin, per month. Pro includes everything in
            Starter. We agree the scope with you up front, before anything goes
            live, and everything we build stays yours.
          </p>
        </Reveal>

        <Reveal delay={0.14} className="mt-8">
          <div className="glass-slab flex flex-col gap-5 rounded-2xl p-7 md:flex-row md:items-center md:gap-7">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <SearchCheck className="size-5 text-accent" strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[17px] font-semibold text-fg">
                Not sure which plan? Start with a free website check-up.
              </h3>
              <p className="mt-1.5 max-w-[72ch] text-[14px] leading-relaxed text-muted">
                We review the site you have today and tell you plainly what
                we&apos;d fix, improve, or rebuild, and which plan actually
                fits, before you pay anything.
              </p>
            </div>
            <a
              href="#audit"
              className="shrink-0 font-medium text-signal underline-offset-4 hover:underline"
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
              Running something bigger or unusual? We custom-build: booking
              engines, AI agents, member areas.
            </p>
            <a
              href="#audit"
              className="group mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-signal transition-colors hover:text-fg"
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
