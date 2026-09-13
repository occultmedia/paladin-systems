import { BookOpenCheck, KeyRound, Unlock, UserCheck } from "lucide-react";
import { Reveal } from "@/components/reveal";

const PROMISES = [
  {
    icon: BookOpenCheck,
    title: "One team for everything",
    body: "Design, development, changes, SEO, and reports: one team, one monthly price, nobody pointing fingers at 'the other vendor'.",
  },
  {
    icon: KeyRound,
    title: "You own everything",
    body: "The domain, the website, the content, the analytics: all in accounts under your name. We build it and hand you the keys.",
  },
  {
    icon: UserCheck,
    title: "A person, not a ticket queue",
    body: "Message us on WhatsApp and a human replies, usually the same person who built your site.",
  },
  {
    icon: Unlock,
    title: "Clear pricing, no lock-in",
    body: "A flat monthly price agreed up front. No surprises, and if you ever leave, the website and everything on it stays yours.",
  },
];

const LOGOS = [
  { slug: "whatsapp", name: "WhatsApp" },
  { slug: "googlecalendar", name: "Google Calendar" },
  { slug: "visa", name: "Visa" },
  { slug: "mastercard", name: "Mastercard" },
  { slug: "n8n", name: "n8n" },
  { slug: "claude", name: "Claude" },
  { slug: "googlegemini", name: "Gemini" },
  { slug: "framer", name: "Framer" },
];

export function WhyUs() {
  return (
    <section id="why-us" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <span aria-hidden className="section-bar" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Serious tools under the hood.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted">
            For your customers it&apos;s just a fast, good-looking website.
            Behind the scenes, we build and run every site with Framer,
            Google Analytics, n8n, Claude, and Gemini, wired to accounts you
            own.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
            {LOGOS.map((logo) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={logo.slug}
                src={`/logos/${logo.slug}.svg`}
                alt={logo.name}
                width={22}
                height={22}
                className="h-[22px] w-auto opacity-70 transition duration-300 hover:scale-110 hover:opacity-100"
              />
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mt-14">
          <div className="glass-slab divide-y divide-edge/80 rounded-2xl px-6 sm:px-8">
            {PROMISES.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-10"
              >
                <div className="flex w-64 shrink-0 items-center gap-3">
                  <item.icon
                    className="size-4 shrink-0 self-center text-accent"
                    strokeWidth={1.5}
                  />
                  <h3 className="text-[15px] font-medium text-fg">
                    {item.title}
                  </h3>
                </div>
                <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
