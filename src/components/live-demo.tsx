import { ChatPlayer, type ChatStep } from "@/components/chat-player";
import { MonthlyReport } from "@/components/monthly-report";
import { Reveal } from "@/components/reveal";

const RATES_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Morning! High season starts Monday. Can you switch the site to the new rates?",
  },
  {
    kind: "action",
    pending: "Updating rates across the site",
    done: "Rates updated on 6 pages",
  },
  {
    kind: "out",
    text: "Done and live. I also updated the FAQ answer about seasonal pricing so everything matches.",
  },
  { kind: "in", text: "Perfect, thanks!" },
  { kind: "status", text: "Shipped the same morning." },
];

const URGENT_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "Our booking button stopped working and we're getting calls!",
  },
  {
    kind: "action",
    pending: "Checking your site",
    done: "Found it: a link broke in an update",
  },
  {
    kind: "out",
    text: "Fixed, bookings are flowing again. We've added a check so this can't happen silently next time.",
  },
  { kind: "status", text: "Watched 24/7, fixed in minutes." },
];

const SEO_SCRIPT: ChatStep[] = [
  {
    kind: "in",
    text: "When tourists search 'jeep tour aruba', we're nowhere. Can you fix that?",
  },
  {
    kind: "action",
    pending: "Running an SEO + GEO audit",
    done: "Audit done: 9 fixes queued",
  },
  {
    kind: "out",
    text: "We're rewriting your tour pages so Google ranks them, and so AI assistants recommend you when travelers ask.",
  },
  {
    kind: "action",
    pending: "Publishing optimized pages",
    done: "Live: 9 pages optimized",
  },
  { kind: "status", text: "Climbing the rankings, tracked monthly." },
];

export function LiveDemo() {
  return (
    <section id="demo" className="scroll-mt-24">
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-32">
        <Reveal>
          <span aria-hidden className="section-bar" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Message us. Consider it done.
          </h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            What a month with Sequence Labs looks like. The small gray steps
            show us working behind the scenes: updating pages, watching
            uptime, and tuning your SEO.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-2 lg:items-start">
          <Reveal delay={0.1}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              A rate change, on WhatsApp
            </p>
            <ChatPlayer
              chrome="whatsapp"
              script={RATES_SCRIPT}
              title="Sequence Labs"
              subtitle="your web team, one message away"
              time="9:12 AM"
              bodyClassName="h-[500px] sm:h-[420px]"
              srDescription="Example WhatsApp chat: a client asks Sequence Labs to switch the site to high-season rates, the team updates 6 pages plus the pricing FAQ, and the change ships the same morning."
            />
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              An urgent fix, after hours
            </p>
            <ChatPlayer
              chrome="widget"
              script={URGENT_SCRIPT}
              title="Chat with us"
              subtitle="your web team, one message away"
              domain="sequencelabs.aw"
              bodyClassName="h-[420px] sm:h-[360px]"
              srDescription="Example chat: a client reports their booking button broke, Sequence Labs finds the broken link, fixes it within minutes, and adds monitoring so it cannot break silently again."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Getting found on Google, and by AI
            </p>
            <ChatPlayer
              chrome="widget"
              script={SEO_SCRIPT}
              title="Chat with us"
              subtitle="your web team, one message away"
              domain="sequencelabs.aw"
              bodyClassName="h-[540px] sm:h-[440px]"
              srDescription="Example chat: a client asks why they don't show up when tourists search for jeep tours in Aruba, Sequence Labs runs an SEO and GEO audit, rewrites and publishes 9 optimized pages, and tracks the rankings monthly."
            />
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              Your report, every month
            </p>
            <MonthlyReport />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
