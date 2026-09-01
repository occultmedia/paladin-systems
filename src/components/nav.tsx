"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { SequenceMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Live Demo", href: "#demo" },
  { label: "Products", href: "#systems" },
  { label: "Why Us", href: "#why-us" },
  { label: "Results", href: "#case-studies" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="glass-slab relative mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-2xl px-4 lg:px-5">
        <a href="#top" className="group flex items-center gap-2.5">
          <SequenceMark className="size-[19px] text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
          <span className="font-display text-sm font-semibold tracking-[0.22em] text-fg">
            SEQUENCE LABS
          </span>
        </a>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="link-underline pb-0.5 text-[13px] text-muted hover:text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="#audit"
            className="btn-metal hidden rounded-[10px] px-4 py-2 text-[13px] font-medium transition-all hover:-translate-y-px active:scale-[0.98] sm:block"
          >
            Get a Free Quote
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-[10px] border border-line text-fg lg:hidden"
          >
            {open ? (
              <X className="size-4" strokeWidth={1.5} />
            ) : (
              <Menu className="size-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass-slab mx-auto mt-2 max-w-[1240px] rounded-2xl px-5 py-2 lg:hidden">
          <nav className="flex flex-col">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-edge/70 py-3 text-sm text-muted last:border-b-0 hover:text-fg"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#audit"
              onClick={() => setOpen(false)}
              className="btn-metal mb-2 mt-3 rounded-[10px] px-4 py-2.5 text-center text-[13px] font-medium sm:hidden"
            >
              Get a Free Quote
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
