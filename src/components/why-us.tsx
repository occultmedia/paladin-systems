import { BookOpenCheck, KeyRound, Unlock, UserCheck } from "lucide-react";
import { Reveal } from "@/components/reveal";

const PROMISES = [
  {
    icon: BookOpenCheck,
    title: "It learns your rules",
    body: "We train your Agent on your prices, policies, and tone of voice, so it answers exactly the way you would.",
  },
  {
    icon: KeyRound,
    title: "You own everything",
    body: "The accounts, the customer chats, the money: all yours. We build the Agent and hand you the keys.",
  },
  {
    icon: UserCheck,
    title: "A person can always step in",
    body: "The Agent knows its limits. Tricky questions go to you or your staff, with the whole conversation attached.",
  },
  {
    icon: Unlock,
    title: "Clear pricing, no lock-in",
    body: "One setup price, and a monthly fee sized to your traffic and agreed up front. No surprises, and if you ever leave, everything we built stays yours.",
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
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Serious tools under the hood.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted">
            For your customers it&apos;s just WhatsApp, Google Calendar, and
            secure card payments. Behind the scenes, we custom-build every
            Agent with n8n, Voiceflow, Claude, Gemini, and Framer, connected to
            accounts you own.
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
