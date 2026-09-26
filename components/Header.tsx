"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  /** Map routes share the "/" pathname, so they're matched on the active map instead. */
  slug?: string;
}

export default function Header({
  activeMapSlug,
  minimal,
}: { activeMapSlug?: string; minimal?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const nav: NavItem[] = [
    { href: "/", label: "JALI Map", slug: "jali" },
    { href: "/?map=map-2", label: "Map 2", slug: "map-2" },
    { href: "/admin", label: "Admin Panel" },
  ];

  const isActive = (n: NavItem) =>
    n.slug ? pathname === "/" && activeMapSlug === n.slug : pathname === n.href;

  const brand = (
    <>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black"
        style={{ background: "var(--gradient-1)", color: "#000" }}
      >
        NV
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-base leading-tight tracking-tight">
          Naksha Vivaran
        </span>
        <span className="text-[10px] text-[var(--text-muted)] leading-tight tracking-widest uppercase">
          Plot Layout Explorer
        </span>
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo — a share view offers no way back into the site */}
        {minimal ? (
          <div className="flex items-center gap-3">{brand}</div>
        ) : (
          <Link href="/" className="flex items-center gap-3 group">
            {brand}
          </Link>
        )}

        {/* Desktop nav */}
        {!minimal && (
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(n)
                    ? "bg-[var(--accent-glow)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <div className="w-px h-5 bg-[var(--border)] mx-2" />
            <a
              href="#contact"
              className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              Contact
            </a>
          </nav>
        )}

        {/* Mobile menu button */}
        {!minimal && (
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] transition-colors"
            onClick={() => setOpen(!open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Mobile nav */}
      {!minimal && open && (
        <div className="md:hidden px-4 pb-4 border-t border-[var(--border)] animate-fade-in">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block py-3 text-sm font-medium ${
                isActive(n) ? "text-[var(--accent)]" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
