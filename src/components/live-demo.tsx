import { ChatPlayer, type ChatStep } from "@/components/chat-player";
import { Reveal } from "@/components/reveal";

const WIDGET_SCRIPT: ChatStep[] = [
  { kind: "in", text: "Hi! How much is the sunset UTV tour?" },
  {
    kind: "out",
    text: "It's $129 per driver and $59 per passenger. Goggles and water included.",
  },
  { kind: "in", text: "Do you have space for 6 people this Saturday?" },
  {
    kind: "action",
    pending: "Checking Saturday's live calendar",
    done: "Saturday 4 PM: 3 UTVs open",
  },
  {
    kind: "out",
    text: "Yes! Saturday 4 PM has 3 UTVs open, which fits 6 people. Want me to reserve them?",
  },
  { kind: "in", text: "Yes please. Can we pay half now?" },
  {
    kind: "action",
    pending: "Creating a secure payment link",
    done: "Payment link ready",
  },
  {
    kind: "out",
    text: "Done, the UTVs are on hold. Pay the $290 deposit here to confirm:",
    link: "Secure payment link",
  },
  { kind: "status", text: "Deposit received. See you Saturday at 4 PM!" },
];

const WHATSAPP_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Good evening! Do you have 2 spots on tomorrow's sunset sail?",
  },
  {
    kind: "action",
    pending: "Checking tomorrow's manifest",
    done: "Tomorrow: full. Sunday: 8 spots open",
  },
  {
    kind: "out",
    text: "Tomorrow is fully booked, sorry! But Sunday's 5 PM sail has 8 spots open. Same route, same open bar. Should I hold 2?",
  },
  { kind: "in", text: "Sunday works!" },
  {
    kind: "out",
    text: "Perfect. Confirm with a $40 deposit here:",
    link: "Secure payment link",
  },
  { kind: "status", text: "Deposit received. 2 spots confirmed for Sunday 5 PM." },
];

export function LiveDemo() {
  return (
    <section id="demo" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Watch it close a booking.
          </h2>
          <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-muted">
            Two real conversations, start to finish. The small gray steps show
            the Agent checking your calendar behind the scenes.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-2 lg:items-start">
          <Reveal delay={0.1}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              On your website
            </p>
            <ChatPlayer
              chrome="widget"
              script={WIDGET_SCRIPT}
              title="Chat with us"
              subtitle="replies instantly, day and night"
              domain="yourbusiness.aw"
              bodyClassName="min-h-[478px]"
              srDescription="Example website chat: a customer asks the price of the sunset UTV tour, the assistant answers, checks the live calendar for Saturday, finds 3 UTVs open, creates a secure payment link, and the deposit is received."
            />
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              On WhatsApp
            </p>
            <ChatPlayer
              chrome="whatsapp"
              script={WHATSAPP_SCRIPT}
              title="Your Charter Company"
              subtitle="online, replies in seconds"
              time="9:12 PM"
              bodyClassName="min-h-[368px]"
              srDescription="Example WhatsApp chat: a customer asks for 2 spots on tomorrow's sunset sail, the assistant checks the manifest, finds tomorrow full but Sunday open, offers Sunday, sends a secure payment link, and the deposit is received."
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
