import Link from "next/link";
import { SequenceLogo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-8 bg-mint px-5 text-center">
      <SequenceLogo className="h-48 w-auto" />
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Page not found</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-950">That page doesn&apos;t exist.</h1>
      </div>
      <Link
        href="/"
        className="rounded-full bg-zinc-950 px-6 py-3 font-display text-[14px] font-semibold text-mint transition-colors hover:bg-zinc-800"
      >
        Back to the homepage
      </Link>
    </div>
  );
}
