import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id) {
    return NextResponse.json({});
  }

  const user = await db.user.findUnique({
    where: { id: token.id as string },
    include: { settings: true },
  });

  if (!user) {
    return NextResponse.json({});
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.avatar,
      currency: user.currency,
      onboardingCompleted: Boolean(user.onboardingCompleted),
      onboardingStep: user.onboardingStep,
      pinEnabled: user.settings?.pinEnabled ?? false,
      biometricEnabled: user.settings?.biometricEnabled ?? false,
    },
    expires: token.exp ? new Date(Number(token.exp) * 1000).toISOString() : undefined,
  });
}
