import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Admin access control.
 *
 * RLS is the real boundary - `public.is_admin()` gates every write on `plots`,
 * and the allowlist lives in the `admins` table which no API can write to. These
 * helpers exist so an unauthenticated visitor gets a redirect or a 401 *before*
 * a query is attempted, instead of a confusing RLS error.
 *
 * `is_admin` is SECURITY DEFINER, so this reads `admins` with elevated privileges
 * and is not subject to that table's own RLS. If the call errors for any reason
 * the helper fails closed rather than assuming access.
 */

export type AdminStatus =
  | { ok: true; email: string }
  | { ok: false; reason: "no-session" | "not-admin" };

export async function getAdminStatus(): Promise<AdminStatus> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, reason: "no-session" };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    // The function is missing (schema not migrated yet). Fail closed.
    return { ok: false, reason: "not-admin" };
  }

  return isAdmin ? { ok: true, email: user.email } : { ok: false, reason: "not-admin" };
}

/** For server components that must not render for non-admins. */
export async function requireAdmin(): Promise<string> {
  const status = await getAdminStatus();
  if (!status.ok) {
    // Send anyone who is not an admin to the login screen. `next` makes the
    // sign-in form bounce them back here afterwards.
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }
  return status.email;
}

/** For API routes. Returns the email, or null when the caller must be rejected. */
export async function authorizeAdmin(): Promise<string | null> {
  const status = await getAdminStatus();
  return status.ok ? status.email : null;
}
