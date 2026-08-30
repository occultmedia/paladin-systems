import { CheckCircle2, Star } from "lucide-react";

/* Phone-style notification mockups: the review request going out through
   Gmail, and the 5-star Google review coming back in. */
export function ReviewNotifications() {
  return (
    <div className="flex flex-col gap-3">
      <div className="glass-slab rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/gmail.svg"
            alt=""
            width={16}
            height={16}
            className="size-4"
          />
          <span className="text-[12px] font-medium text-muted">Gmail</span>
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.08em] text-muted">
            10:04 AM
          </span>
        </div>
        <p className="mt-2.5 text-[13.5px] font-semibold text-fg">
          Your Charter Company
        </p>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-snug text-muted">
          How was your sunset sail? If you had a good time, would you leave us
          a quick Google review? It takes 30 seconds…
        </p>
      </div>

      <div className="glass-slab rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/google.svg"
            alt=""
            width={16}
            height={16}
            className="size-4"
          />
          <span className="text-[12px] font-medium text-muted">Google</span>
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.08em] text-muted">
            10:31 AM
          </span>
        </div>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-fg">
          New 5-star review
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-3 fill-accent text-accent"
                strokeWidth={1.5}
              />
            ))}
          </span>
        </p>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-snug text-muted">
          &ldquo;Amazing sunset sail! The crew was fantastic and booking was so
          easy.&rdquo; Marisol V.
        </p>
      </div>

      <div className="flex w-fit items-center gap-1.5 rounded-[10px] border border-signal/30 bg-signal/10 px-3 py-1.5">
        <CheckCircle2 className="size-3.5 shrink-0 text-signal" strokeWidth={2} />
        <span className="text-[12.5px] font-medium leading-snug text-signal">
          Sent automatically, the morning after every tour
        </span>
      </div>
    </div>
  );
}
