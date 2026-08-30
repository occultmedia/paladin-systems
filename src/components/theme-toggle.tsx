"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/* Switch-style toggle: left is light (the standard), right is dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("theme");
      } catch {
        /* storage unavailable */
      }
      setTheme(stored === "dark" ? "dark" : "light");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const dark = theme === "dark";

  const toggle = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={toggle}
      className="relative flex h-7 w-[52px] shrink-0 items-center rounded-full border border-line bg-surface/80 px-1 transition-colors hover:border-muted"
    >
      <Sun
        className="absolute left-[7px] size-3 text-muted"
        strokeWidth={2}
        aria-hidden
      />
      <Moon
        className="absolute right-[7px] size-3 text-muted"
        strokeWidth={2}
        aria-hidden
      />
      <span
        className={`relative z-10 block size-5 rounded-full bg-fg shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-300 ${
          dark ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
