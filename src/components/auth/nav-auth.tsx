"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useUser } from "@/lib/auth";

/** Right side of the site nav: Log in / Sign up, or the dashboard once signed in. */
export function NavAuth({ tone = "light" }: { tone?: "light" | "dark" } = {}) {
  const dark = tone === "dark";
  const { user } = useUser();
  if (user)
    return (
      <Link
        href="/dashboard"
        className={`shine inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-display text-[13px] font-semibold transition-colors ${dark ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"}`}
      >
        Open dashboard
        <ArrowUpRight size={14} strokeWidth={2} />
      </Link>
    );
  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
      <Link href="/login" className={`whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-medium transition-colors sm:px-3 ${dark ? "text-zinc-300 hover:bg-white/10 hover:text-white" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"}`}>
        Log in
      </Link>
      <Link
        href="/signup"
        className={`shine group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-display text-[13px] font-semibold transition-colors ${dark ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"}`}
      >
        Sign up
        <ArrowUpRight size={14} strokeWidth={2} className="transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </Link>
    </div>
  );
}
