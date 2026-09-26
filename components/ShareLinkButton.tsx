"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "copied" | "failed";

interface Props {
  slug: string;
  mapName: string;
  /** How long the confirmation stays up before the button returns to idle. */
  resetAfterMs?: number;
}

/**
 * Copies the unlisted single-map link (`/m/<slug>`) for the origin the admin is
 * actually looking at. The host is never hardcoded, so the button is correct on
 * localhost and on the deployed domain alike.
 */
export default function ShareLinkButton({
  slug,
  mapName,
  resetAfterMs = 2000,
}: Props) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/m/${slug}`);
      setState("copied");
    } catch {
      // Clipboard writes fail outside a secure context or when permission is
      // denied, so say so rather than pretending the link was copied.
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), resetAfterMs);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Failed · Try again" : "Share";
  const link = typeof window === "undefined" ? `/m/${slug}` : `${window.location.origin}/m/${slug}`;

  return (
    <button
      type="button"
      onClick={copyLink}
      aria-label={`Copy share link for ${mapName}`}
      title={link}
      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-all"
      style={{
        background: state === "copied" ? "var(--accent-glow)" : "var(--bg-card)",
        color: state === "copied" ? "var(--accent)" : "var(--text-muted)",
        borderColor: state === "copied" ? "rgba(0,212,170,0.35)" : "var(--border)",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {label}
    </button>
  );
}
