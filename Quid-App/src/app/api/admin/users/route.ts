import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getUserDataCounts } from "@/lib/admin-data";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        telegramId: true,
        createdAt: true,
        updatedAt: true,
        onboardingCompleted: true,
      },
    });

    const usersWithCounts = await Promise.all(
      users.map(async (user) => ({
        ...user,
        counts: await getUserDataCounts(db, user.id),
      }))
    );

    return NextResponse.json({ users: usersWithCounts });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Error al cargar usuarios" }, { status: 500 });
  }
}
