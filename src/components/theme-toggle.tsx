"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

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
      /* Light is the standard; dark only when the visitor chose it. */
      setTheme(stored === "dark" ? "dark" : "light");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
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
      onClick={toggle}
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      className="flex size-9 items-center justify-center rounded-[10px] border border-line text-muted transition-colors hover:border-muted hover:text-fg"
    >
      {theme === "light" ? (
        <Moon className="size-4" strokeWidth={1.5} />
      ) : theme === "dark" ? (
        <Sun className="size-4" strokeWidth={1.5} />
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
