"use client";

import { SequenceMark } from "@/components/logo";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-6 px-5 text-center">
      <SequenceMark className="size-10 text-accent" />
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted">
          Something went wrong
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">
          The page hit a snag.
        </h1>
      </div>
      <button
        type="button"
        onClick={reset}
        className="btn-metal rounded-[10px] px-6 py-3 text-[14px] font-medium transition-all hover:-translate-y-0.5"
      >
        Try again
      </button>
    </div>
  );
}
