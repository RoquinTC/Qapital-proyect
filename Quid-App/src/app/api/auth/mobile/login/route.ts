import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";

const MOBILE_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Servidor sin configuración de sesión" }, { status: 500 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña son requeridos" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { settings: true },
  });

  if (!user || !await compare(password, user.password)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  const tokenPayload = {
    id: user.id,
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.avatar,
    currency: user.currency,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    onboardingStep: user.onboardingStep,
    pinEnabled: user.settings?.pinEnabled ?? false,
    biometricEnabled: user.settings?.biometricEnabled ?? false,
  };
  const token = await encode({
    secret,
    token: tokenPayload,
    maxAge: MOBILE_SESSION_MAX_AGE,
  });

  return NextResponse.json({
    token,
    session: {
      user: {
        ...tokenPayload,
        image: user.avatar,
      },
      expires: new Date(Date.now() + MOBILE_SESSION_MAX_AGE * 1000).toISOString(),
    },
  });
}
