import Link from "next/link";
import { SequenceMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-6 px-5 text-center">
      <SequenceMark className="size-10 text-accent" />
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted">
          Page not found
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">
          That page doesn&apos;t exist.
        </h1>
      </div>
      <Link
        href="/"
        className="btn-metal rounded-[10px] px-6 py-3 text-[14px] font-medium transition-all hover:-translate-y-0.5"
      >
        Back to the homepage
      </Link>
    </div>
  );
}
