import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, vehicleReminderCreateSchema } from "@/lib/validations";

function serializeReminder(reminder: {
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}) {
  return {
    ...reminder,
    dueDate: reminder.dueDate?.toISOString() ?? null,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

async function requireOwnedVehicle(vehicleId: string, userId: string) {
  return db.vehicle.findFirst({
    where: { id: vehicleId, userId },
    select: { id: true, currentKm: true },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const vehicle = await requireOwnedVehicle(id, session.user.id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const reminders = await db.vehicleReminder.findMany({
      where: { vehicleId: id, userId: session.user.id },
      orderBy: [
        { isActive: "desc" },
        { dueDate: "asc" },
        { dueKm: "asc" },
      ],
    });

    return NextResponse.json(reminders.map(serializeReminder));
  } catch (error) {
    console.error("Get vehicle reminders error:", error);
    return NextResponse.json({ error: "Error al obtener recordatorios" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const vehicle = await requireOwnedVehicle(id, session.user.id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const body = await validateBody(req, vehicleReminderCreateSchema);
    const reminder = await db.vehicleReminder.create({
      data: {
        vehicleId: id,
        userId: session.user.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        category: body.category || "custom",
        triggerMode: body.triggerMode || "date",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueKm: body.dueKm ?? null,
        warningDays: body.warningDays ?? 7,
        warningKm: body.warningKm ?? 500,
        repeatIntervalDays: body.repeatIntervalDays ?? null,
        repeatIntervalKm: body.repeatIntervalKm ?? null,
        isActive: body.isActive ?? true,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        completedKm: body.completedKm ?? null,
      },
    });

    return NextResponse.json(serializeReminder(reminder), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create vehicle reminder error:", error);
    return NextResponse.json({ error: "Error al crear recordatorio" }, { status: 500 });
  }
}
