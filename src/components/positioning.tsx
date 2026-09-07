import { Reveal } from "@/components/reveal";

const SPECIALTIES = [
  {
    name: "Websites",
    body: "Designed, built, and launched by us: fast, beautiful, and easy to find on Google.",
  },
  {
    name: "Bookings",
    body: "Add an Agent and every inquiry is answered and closed the moment it arrives, 24 hours a day.",
  },
  {
    name: "Customer acquisition",
    body: "Follow-ups, reviews, and repeat guests, working for you on autopilot.",
  },
];

export function Positioning() {
  return (
    <section>
      <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <h2 className="max-w-[22ch] font-display text-[clamp(30px,3.6vw,52px)] font-semibold leading-[1.08] tracking-tight text-fg">
            A boutique studio that builds it{" "}
            <span className="bg-gradient-to-r from-fg via-accent to-muted bg-clip-text text-transparent">
              end to end.
            </span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-7 max-w-[58ch] text-[16px] leading-relaxed text-muted lg:text-[17px]">
            We build the website your business deserves, and the AI that puts
            it to work.{" "}
            <span className="text-fg">
              We don&apos;t sell templates, and we don&apos;t sell chatbots
              that answer FAQ questions:
            </span>{" "}
            every site is designed around how you operate, and every Agent we
            add catches bookings and turns happy customers into the next ones.
          </p>
        </Reveal>

        <Reveal delay={0.16} className="mt-14">
          <div className="grid grid-cols-1 gap-y-8 divide-y divide-edge/70 sm:grid-cols-3 sm:gap-y-0 sm:divide-x sm:divide-y-0">
            {SPECIALTIES.map((specialty, i) => (
              <div
                key={specialty.name}
                className={`${i > 0 ? "pt-8 sm:pt-0" : ""} ${
                  i === 0 ? "sm:pr-10" : i === 1 ? "sm:px-10" : "sm:pl-10"
                }`}
              >
                <h3 className="font-display text-xl font-semibold tracking-tight text-fg">
                  {specialty.name}
                </h3>
                <p className="mt-3 max-w-[30ch] text-[14px] leading-relaxed text-muted">
                  {specialty.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-12 max-w-[58ch] text-[15px] leading-relaxed text-muted">
            <span className="text-fg">Small by choice.</span> We take on a few
            clients at a time and build every Agent like it&apos;s for our own
            business, because we run our own businesses on these too.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
