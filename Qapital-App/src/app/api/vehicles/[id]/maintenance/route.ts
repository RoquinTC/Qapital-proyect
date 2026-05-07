import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createColombiaDate, getColombiaNow } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const vehicle = await db.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const maintenanceRecords = await db.maintenanceRecord.findMany({
      where: { vehicleId: id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(maintenanceRecords);
  } catch (error) {
    console.error("Get maintenance records error:", error);
    return NextResponse.json({ error: "Error al obtener registros de mantenimiento" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { type, description, cost, km, date, nextDueKm, nextDueDate, reminderEnabled } = body;

    if (!description || !cost) {
      return NextResponse.json({ error: "Descripción y costo son requeridos" }, { status: 400 });
    }

    const vehicle = await db.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const maintenanceRecord = await db.maintenanceRecord.create({
      data: {
        vehicleId: id,
        type: type || "general",
        description,
        cost: parseFloat(cost),
        km: km ? parseFloat(km) : vehicle.currentKm,
        date: date ? createColombiaDate(date.split("T")[0]) : getColombiaNow(),
        nextDueKm: nextDueKm ? parseFloat(nextDueKm) : null,
        nextDueDate: nextDueDate ? createColombiaDate(nextDueDate.split("T")[0]) : null,
        reminderEnabled: reminderEnabled ?? true,
      },
    });

    // Update vehicle currentKm if provided km is greater
    if (km && parseFloat(km) > vehicle.currentKm) {
      await db.vehicle.update({
        where: { id },
        data: { currentKm: parseFloat(km) },
      });
    }

    // Create finance transaction for cross-module sync
    await db.transaction.create({
      data: {
        userId: session.user.id,
        type: "expense",
        category: "Transporte",
        subCategory: "Mantenimiento",
        amount: parseFloat(cost),
        description: `Mantenimiento - ${vehicle.name}: ${description}`,
        date: date ? createColombiaDate(date.split("T")[0]) : getColombiaNow(),
        sourceModule: "transport",
        sourceId: maintenanceRecord.id,
        accountId: null,
      },
    });

    return NextResponse.json(maintenanceRecord, { status: 201 });
  } catch (error) {
    console.error("Create maintenance record error:", error);
    return NextResponse.json({ error: "Error al crear registro de mantenimiento" }, { status: 500 });
  }
}
