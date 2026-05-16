import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createColombiaDate, getColombiaNow } from "@/lib/api";
import { validateBody, fuelLogCreateSchema } from "@/lib/validations";

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

    const fuelLogs = await db.fuelLog.findMany({
      where: { vehicleId: id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(fuelLogs);
  } catch (error) {
    console.error("Get fuel logs error:", error);
    return NextResponse.json({ error: "Error al obtener registros de combustible" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await validateBody(req, fuelLogCreateSchema);
    const { date, km, amount, pricePerGallon, isFullTank, notes } = body;

    const vehicle = await db.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const gallons = amount / pricePerGallon;

    const fuelLog = await db.fuelLog.create({
      data: {
        vehicleId: id,
        date: date ? createColombiaDate(date.split("T")[0]) : getColombiaNow(),
        km: km ?? vehicle.currentKm,
        amount,
        pricePerGallon,
        gallons: Math.round(gallons * 100) / 100,
        isFullTank: isFullTank ?? true,
        notes,
      },
    });

    // Update vehicle currentKm if provided km is greater
    if (km && km > vehicle.currentKm) {
      await db.vehicle.update({
        where: { id },
        data: { currentKm: km },
      });
    }

    // Create finance transaction for cross-module sync
    await db.transaction.create({
      data: {
        userId: session.user.id,
        type: "expense",
        category: "Transporte",
        subCategory: "Combustible",
        amount,
        description: `Combustible - ${vehicle.name}`,
        date: date ? createColombiaDate(date.split("T")[0]) : getColombiaNow(),
        sourceModule: "transport",
        sourceId: fuelLog.id,
        accountId: null,
      },
    });

    return NextResponse.json(fuelLog, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create fuel log error:", error);
    return NextResponse.json({ error: "Error al crear registro de combustible" }, { status: 500 });
  }
}
