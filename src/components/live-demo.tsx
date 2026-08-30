import { ChatPlayer, type ChatStep } from "@/components/chat-player";
import { ReviewNotifications } from "@/components/review-notifications";
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

const RENTAL_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Hi! How much is an automatic SUV for 5 days next week?",
  },
  {
    kind: "action",
    pending: "Checking the fleet",
    done: "3 SUVs free next week",
  },
  {
    kind: "out",
    text: "An automatic SUV is $68 per day, so $340 for 5 days with full insurance. Want me to hold one for you?",
  },
  { kind: "in", text: "Yes, Monday to Friday please" },
  {
    kind: "action",
    pending: "Holding your SUV",
    done: "SUV reserved: Monday to Friday",
  },
  {
    kind: "out",
    text: "Done! Pay the $80 deposit here and it's yours:",
    link: "Secure payment link",
  },
  { kind: "status", text: "Deposit received. Your SUV is ready Monday at 9 AM." },
];

export function LiveDemo() {
  return (
    <section id="demo" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Watch it close a booking.
          </h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            Four real examples from Agents we build. The small gray steps show
            the Agent working behind the scenes: checking calendars, fleets,
            and payments.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-2 lg:items-start">
          <Reveal delay={0.1}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Tours, on your website
            </p>
            <ChatPlayer
              chrome="widget"
              script={WIDGET_SCRIPT}
              title="Chat with us"
              subtitle="replies instantly, day and night"
              domain="yourbusiness.aw"
              bodyClassName="h-[660px] sm:h-[520px]"
              srDescription="Example website chat: a customer asks the price of the sunset UTV tour, the Agent answers, checks the live calendar for Saturday, finds 3 UTVs open, creates a secure payment link, and the deposit is received."
            />
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Charters, on WhatsApp
            </p>
            <ChatPlayer
              chrome="whatsapp"
              script={WHATSAPP_SCRIPT}
              title="Your Charter Company"
              subtitle="online, replies in seconds"
              time="9:12 PM"
              bodyClassName="h-[460px] sm:h-[384px]"
              srDescription="Example WhatsApp chat: a customer asks for 2 spots on tomorrow's sunset sail, the Agent checks the manifest, finds tomorrow full but Sunday open, offers Sunday, sends a secure payment link, and the deposit is received."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Car rentals, on your website
            </p>
            <ChatPlayer
              chrome="widget"
              script={RENTAL_SCRIPT}
              title="Chat with us"
              subtitle="replies instantly, day and night"
              domain="your-rentals.aw"
              bodyClassName="h-[540px] sm:h-[440px]"
              srDescription="Example website chat for a car rental: a customer asks the price of an automatic SUV for 5 days, the Agent checks the fleet, quotes $340, reserves the SUV for Monday to Friday, sends a secure payment link, and the deposit is received."
            />
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Reviews, via Gmail
            </p>
            <ReviewNotifications />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
