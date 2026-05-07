import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, logId } = await params;

    const vehicle = await db.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const existing = await db.fuelLog.findFirst({
      where: { id: logId, vehicleId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    await db.fuelLog.delete({ where: { id: logId } });

    // Delete the linked finance transaction
    await db.transaction.deleteMany({
      where: { sourceModule: "transport", sourceId: logId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete fuel log error:", error);
    return NextResponse.json({ error: "Error al eliminar registro de combustible" }, { status: 500 });
  }
}
