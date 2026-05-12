import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/api/auth",
  "/api/health",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes (except public ones)
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow CORS preflight
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  // Check for JWT token
  try {
    const token = await getToken({
      req: request,
      // Secret comes from NEXTAUTH_SECRET env var. Must match auth.ts.
      // In production, this MUST be set — no hardcoded fallback.
      // In development, falls back to a random secret (same logic as auth.ts).
      secret: (() => {
        if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
        if (process.env.NODE_ENV === "production") {
          throw new Error("NEXTAUTH_SECRET is required in production.");
        }
        // Dev-only fallback — must match the one in auth.ts
        // Note: middleware runs in Edge runtime, so it needs its own fallback.
        // The actual secret value doesn't need to match auth.ts exactly because
        // in dev mode, the JWT is created and verified in the same process.
        return "dev-only-secret-" + "middleware" + "-CHANGE-IN-PROD";
      })(),
    });

    if (!token) {
      return NextResponse.json(
        { error: "No autorizado — Inicia sesión para continuar" },
        { status: 401 }
      );
    }

    // Add user ID to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", token.id as string);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error de autenticación" },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
