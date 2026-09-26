import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Only same-origin, non-login paths are allowed as a post-sign-in destination.
 *
 * Without this, `/login?next=https://evil.example` would hand a freshly
 * authenticated admin straight off to another site. `//host` is rejected too
 * because browsers treat it as a protocol-relative absolute URL even though it
 * starts with a slash.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  if (raw.startsWith("/login")) return "/admin";
  return raw;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)]">
          <span className="text-sm text-[var(--text-secondary)]">Loading…</span>
        </div>
      }
    >
      <LoginForm next={safeNext(searchParams.next)} />
    </Suspense>
  );
}
