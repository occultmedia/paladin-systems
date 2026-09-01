import { Plus } from "lucide-react";
import { Reveal } from "@/components/reveal";

/* Single source of truth: rendered on the page and mirrored into the
   FAQPage structured data in page.tsx. Keep both in sync by editing here. */
export const FAQS = [
  {
    question: "What exactly is an AI Agent?",
    answer:
      "A digital receptionist we custom-build for your business. It lives in your WhatsApp and website chat, knows your prices, schedule, and company rules, and it doesn't just answer questions: it checks real availability, holds spots, and collects deposits with secure payment links.",
  },
  {
    question: "Does it work with WhatsApp?",
    answer:
      "Yes, WhatsApp is where most Aruban customers already message you, so it's usually the first place we install your Agent. It also works as a chat widget on your website, and it can send automatic emails, like review requests after a tour.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Installation is a one-time $1,500 for any Agent. Monthly maintenance starts at $200 and depends on the size of your website and how many customers your Agent talks to. Special features are quoted separately at one fixed price, and we agree every number with you before anything goes live.",
  },
  {
    question: "How long does it take to go live?",
    answer:
      "About 14 days from our first call. We audit how your bookings work today, build the Agent, you test it, and then it goes live on your channels.",
  },
  {
    question: "Do I need a new website?",
    answer:
      "No. Your Agent installs on the website you already have and on your WhatsApp number. If you don't have a website yet, we can build one too.",
  },
  {
    question: "What languages does it speak?",
    answer:
      "English, Spanish, Dutch, and Papiamento, so it answers your guests the way Aruba actually talks.",
  },
  {
    question: "What happens when it doesn't know the answer?",
    answer:
      "It hands the conversation to you or your staff, with the full chat history attached. The Agent knows its limits: a person can always step in.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
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
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15.5px] font-medium text-fg transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <Plus
                    aria-hidden
                    className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45"
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
