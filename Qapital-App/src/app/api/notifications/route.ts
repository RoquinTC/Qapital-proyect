import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const notifications = await db.appNotification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const unreadCount = await db.appNotification.count({
      where: { userId: session.user.id, read: false },
    });

    // Parse the `data` JSON field before returning
    const parsed = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      data: n.data ? JSON.parse(n.data) : null,
      createdAt: n.createdAt,
    }));

    return NextResponse.json({ notifications: parsed, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Error al obtener notificaciones" },
      { status: 500 }
    );
  }
}
