import { Plus } from "lucide-react";
import { Reveal } from "@/components/reveal";

/* Single source of truth: rendered on the page and mirrored into the
   FAQPage structured data in page.tsx. Keep both in sync by editing here. */
export const FAQS = [
  {
    question: "What do I get for Afl. 250 a month?",
    answer:
      "The Base plan: we design and build your website, then keep it maintained month after month, with small changes here and there on request. The build is part of the plan, so there's no big upfront project invoice.",
  },
  {
    question: "What's different about Pro?",
    answer:
      "Pro (Afl. 500 a month) is the all-in-one: everything in Base, plus SEO and GEO so people actually find you, monthly content changes to keep the site fresh, and a Google Analytics report in your inbox every month that explains what's working in plain language.",
  },
  {
    question: "What is GEO?",
    answer:
      "Generative Engine Optimization. More and more travelers ask AI assistants like ChatGPT, Claude, or Gemini what to do in Aruba. GEO is how we make sure those assistants know your business and recommend it, on top of classic Google SEO.",
  },
  {
    question: "I already have a website. Do I still need the build?",
    answer:
      "No problem: we can take over the site you already have, clean it up, and run it under the same monthly plans. If it's genuinely holding you back, we'll tell you plainly and rebuild it as part of your plan.",
  },
  {
    question: "How do I request changes?",
    answer:
      "Send us a WhatsApp or an email, the way you'd text a colleague. We confirm what we understood, make the change, and send you the link when it's live.",
  },
  {
    question: "Do I own my website?",
    answer:
      "Yes. The domain, the website, the content, and the analytics live in accounts under your name. If you ever leave, all of it stays with you.",
  },
  {
    question: "What does Enterprise cost?",
    answer:
      "There's no fixed price because there's no fixed scope: multiple sites or brands, AI agents, booking systems, custom integrations. We talk, we scope it together, and you get one clear monthly number before anything starts.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <span aria-hidden className="section-bar" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Questions, answered.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            The things every business owner asks us first.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <div className="glass-slab divide-y divide-edge/80 rounded-2xl px-6 sm:px-8">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15.5px] font-medium text-fg transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <Plus
                    aria-hidden
                    className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 group-open:text-signal"
                    strokeWidth={1.5}
                  />
                </summary>
                <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
