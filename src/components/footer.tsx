import { PaladinMark } from "@/components/logo";

const LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Live Demo", href: "#demo" },
  { label: "Products", href: "#systems" },
  { label: "Why Us", href: "#why-us" },
  { label: "Results", href: "#case-studies" },
];

export function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-5 py-14 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <PaladinMark className="size-5 text-accent" />
            <span className="font-display text-[13px] font-semibold tracking-[0.22em] text-fg">
              PALADIN SYSTEMS
            </span>
          </div>
          <p className="mt-3 max-w-[38ch] text-[13px] leading-relaxed text-muted">
            High-end AI integration for Aruban businesses. Oranjestad, Aruba.
          </p>
        </div>

        <div className="flex flex-col gap-5 md:items-end">
          <nav className="flex flex-wrap gap-x-7 gap-y-2">
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
          <p className="font-mono text-[11px] text-muted">
            &copy; 2026 Paladin Systems
          </p>
        </div>
      </div>
    </footer>
  );
}
