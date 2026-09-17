"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname === "/admin";

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ background: "var(--gradient-1)", color: "#000" }}>
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
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isAdmin
                ? "bg-[var(--accent-glow)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
            }`}
          >
            Map
          </Link>
          <Link
            href="/admin"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isAdmin
                ? "bg-[var(--accent-glow)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
            }`}
          >
            Admin Panel
          </Link>
          <div className="w-px h-5 bg-[var(--border)] mx-2" />
          <a
            href="#contact"
            className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            Contact
          </a>
        </nav>

        {/* Mobile menu button */}
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
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden px-4 pb-4 border-t border-[var(--border)] animate-fade-in">
          <Link href="/" className="block py-3 text-sm font-medium" onClick={() => setOpen(false)}>
            Map
          </Link>
          <Link href="/admin" className="block py-3 text-sm font-medium" onClick={() => setOpen(false)}>
            Admin Panel
          </Link>
        </div>
      )}
    </header>
  );
}
