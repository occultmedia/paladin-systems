"use client";

/* Landing nav: transparent over the white hero, frosted white with a hairline once you scroll. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavAuth } from "@/components/auth/nav-auth";
import { Wordmark } from "@/components/logo";

const LINKS: Array<[string, string]> = [
  ["AI", "#ai-signal"],
  ["3D Map", "#map"],
  ["For agents", "#agents"],
  ["For investors", "#investors"],
  ["Pricing", "#pricing"],
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
        solid ? "border-b border-zinc-200 bg-white/90 backdrop-blur" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-12">
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
