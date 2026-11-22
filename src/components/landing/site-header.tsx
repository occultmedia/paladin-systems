"use client";

/* Landing nav: transparent over the white hero, frosted white with a hairline once you scroll. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavAuth } from "@/components/auth/nav-auth";
import { Wordmark } from "@/components/logo";

const LINKS: Array<[string, string]> = [
  ["AI", "#ai-signal"],
  ["For agents", "#agents"],
  ["For investors", "#investors"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
];

export function SiteHeader() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] transition-[background-color,border-color,backdrop-filter] duration-300 ${
        solid ? "border-b border-white/70 bg-white/60 shadow-[0_1px_0_rgb(10_10_10/0.06),0_10px_30px_-18px_rgb(10_10_10/0.25)] backdrop-blur-xl backdrop-saturate-150" : "border-b border-zinc-200 bg-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="Terminal home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`link-underline text-[14px] font-medium transition-colors text-zinc-600 hover:text-zinc-950`}
            >
              {label}
            </a>
          ))}
        </nav>
        <NavAuth />
      </div>
    </header>
  );
}
