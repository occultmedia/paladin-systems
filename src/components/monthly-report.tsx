import { CheckCircle2, TrendingUp } from "lucide-react";

/* Phone-style notification mockups: the monthly report landing in the
   client's inbox, and the ranking win it reports. */
export function MonthlyReport() {
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
          Sequence Labs: your August website report
        </p>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-snug text-muted">
          Visitors up 23%, your sunset cruise page is the new top landing
          page, and 9 SEO fixes went live. Full breakdown inside&hellip;
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
          <span className="text-[12px] font-medium text-muted">
            Google Search
          </span>
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.08em] text-muted">
            THIS MONTH
          </span>
        </div>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-fg">
          &ldquo;sunset cruise aruba&rdquo;
          <span className="flex items-center gap-1 text-signal">
            <TrendingUp className="size-3.5" strokeWidth={2} />
            #1 result
          </span>
        </p>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-snug text-muted">
          Your tours page now ranks first, and AI assistants recommend it
          when travelers ask what to do in Aruba.
        </p>
      </div>

      <div className="flex w-fit items-center gap-1.5 rounded-[10px] border border-signal/30 bg-signal/10 px-3 py-1.5">
        <CheckCircle2 className="size-3.5 shrink-0 text-signal" strokeWidth={2} />
        <span className="text-[12.5px] font-medium leading-snug text-signal">
          Sent automatically, the first week of every month
        </span>
      </div>
    </div>
  );
}
