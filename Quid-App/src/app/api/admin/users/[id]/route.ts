import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { deleteUserCompletely, getUserDataCounts } from "@/lib/admin-data";

const unauthorizedResponse = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ user: { ...user, counts: await getUserDataCounts(db, id) } });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Error al cargar usuario" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user: admin, error } = await requireAdmin();
    if (error) return error;
    if (!admin) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";

    if (admin.id === id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario desde el panel admin" },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (confirmEmail !== target.email.toLowerCase()) {
      return NextResponse.json(
        { error: "La confirmación no coincide con el correo del usuario" },
        { status: 400 }
      );
    }

    const deletedCounts = await db.$transaction(async (tx) => {
      const counts = await getUserDataCounts(tx, id);
      await deleteUserCompletely(tx, id);
      return counts;
    });

    return NextResponse.json({
      success: true,
      deletedUser: { id: target.id, name: target.name, email: target.email },
      deletedCounts,
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
