import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get pending invitations where the current user is the invitee
    const invitations = await db.accountInvitation.findMany({
      where: {
        inviteeId: session.user.id,
        status: "pending",
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get count of unread notifications
    const unreadCount = await db.appNotification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        role: inv.role,
        status: inv.status,
        createdAt: inv.createdAt,
        account: inv.account,
        inviter: inv.inviter,
      })),
      unreadNotifications: unreadCount,
    });
  } catch (error) {
    console.error("List invitations error:", error);
    return NextResponse.json(
      { error: "Error al obtener las invitaciones" },
      { status: 500 }
    );
  }
}
