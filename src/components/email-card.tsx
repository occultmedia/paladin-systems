import { CheckCircle2, Mail, Star } from "lucide-react";

/* Static mockup of the automatic post-tour review email. */
export function EmailCard() {
  return (
    <div className="glass-slab overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-edge/80 px-4 py-3">
        <Mail className="size-5 shrink-0 text-accent" strokeWidth={1.5} />
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg">
          New message
        </p>
        <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted">
          10:04 AM
        </span>
      </div>

      <div className="space-y-1.5 border-b border-edge/80 px-4 py-3 text-[12.5px] leading-snug">
        <p>
          <span className="text-muted">From:</span>{" "}
          <span className="text-fg">Your Charter Company</span>
        </p>
        <p>
          <span className="text-muted">To:</span>{" "}
          <span className="text-fg">Marisol V.</span>
        </p>
        <p>
          <span className="text-muted">Subject:</span>{" "}
          <span className="font-medium text-fg">How was your sunset sail?</span>
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="max-w-[52ch] text-[14px] leading-relaxed text-fg">
          Hi Marisol! Thank you for sailing with us yesterday. If you had a
          good time, would you leave us a quick Google review? It takes 30
          seconds and helps our small local crew a lot.
        </p>

        <div className="mt-4 flex w-fit items-center gap-2.5 rounded-[10px] border border-accent/30 bg-surface px-3.5 py-2">
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-3.5 fill-accent text-accent"
                strokeWidth={1.5}
              />
            ))}
          </span>
          <span className="text-[12.5px] font-medium text-accent">
            Leave a Google review
          </span>
        </div>

        <div className="mt-5 flex w-fit items-center gap-1.5 rounded-[10px] border border-signal/30 bg-signal/10 px-3 py-1.5">
          <CheckCircle2 className="size-3.5 shrink-0 text-signal" strokeWidth={2} />
          <span className="text-[12.5px] font-medium leading-snug text-signal">
            Sent automatically, the morning after every tour
          </span>
        </div>
      </div>
    </div>
  );
}
