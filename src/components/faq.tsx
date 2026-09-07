import { Plus } from "lucide-react";
import { Reveal } from "@/components/reveal";

/* Single source of truth: rendered on the page and mirrored into the
   FAQPage structured data in page.tsx. Keep both in sync by editing here. */
export const FAQS = [
  {
    question: "What does Sequence Labs actually build?",
    answer:
      "Websites, first and foremost: custom-designed, fast, and built to bring in business. On top of that, you can add an AI Agent whenever you're ready: an upgrade that answers customers on your website and WhatsApp, takes bookings, and collects deposits automatically.",
  },
  {
    question: "What exactly is an AI Agent?",
    answer:
      "A digital receptionist we custom-build for your business. It lives in your WhatsApp and website chat, knows your prices, schedule, and company rules, and it doesn't just answer questions: it checks real availability, holds spots, and collects deposits with secure payment links.",
  },
  {
    question: "How much does it cost?",
    answer:
      "The website is quoted per project at one fixed price after a free call, sized to the pages and features you need. Adding an Agent is a one-time $1,500 installation, with monthly maintenance from $200 depending on the size of your website and how many customers it talks to. We agree every number with you before anything goes live.",
  },
  {
    question: "How long does it take to go live?",
    answer:
      "Most websites are live about 14 days after our first call: we design, you review, we launch. Adding an Agent takes about another week on top, including your own testing time.",
  },
  {
    question: "I already have a website. Can you still help?",
    answer:
      "Yes. We can redesign it, rebuild it from scratch, or leave it exactly as it is and just install an Agent on the site and WhatsApp number you already have.",
  },
  {
    question: "Does the Agent work with WhatsApp?",
    answer:
      "Yes, WhatsApp is where most Aruban customers already message you, so it's usually the first place we install your Agent. It also works as a chat widget on your website, and it can send automatic emails, like review requests after a tour.",
  },
  {
    question: "What languages do you build in?",
    answer:
      "Your website and your Agent both speak English, Spanish, Dutch, and Papiamento, so you answer guests the way Aruba actually talks.",
  },
  {
    question: "What happens when the Agent doesn't know the answer?",
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
