import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guards";

const DEFAULT_ADMIN_EMAIL = "rqcquintero@gmail.com";

export function getAdminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL;
  return configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function requireAdmin() {
  const { session, error } = await requireAuth();
  if (error || !session?.user?.id) {
    return { session: null, user: null, error };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });

  if (!user || !isAdminEmail(user.email)) {
    return {
      session: null,
      user: null,
      error: NextResponse.json({ error: "Solo el administrador puede acceder a esta acción" }, { status: 403 }),
    };
  }

  return { session, user, error: null };
}
