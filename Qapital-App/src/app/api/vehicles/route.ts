import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, vehicleCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const vehicles = await db.vehicle.findMany({
      where: { userId: session.user.id },
      include: {
        fuelLogs: { orderBy: { date: "desc" }, take: 1 },
        maintenanceRecords: {
          orderBy: { date: "desc" },
          where: { nextDueKm: { not: null } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("Get vehicles error:", error);
    return NextResponse.json({ error: "Error al obtener vehículos" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await validateBody(req, vehicleCreateSchema);
    const { name, type, brand, model, year, color, tankCapacity, fuelType, currentKm } = body;

    const vehicle = await db.vehicle.create({
      data: {
        userId: session.user.id,
        name,
        type: type || "motorcycle",
        brand,
        model,
        year,
        color,
        tankCapacity,
        fuelType: fuelType || "gasoline",
        currentKm: currentKm ?? 0,
      },
      include: {
        fuelLogs: true,
        maintenanceRecords: true,
      },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create vehicle error:", error);
    return NextResponse.json({ error: "Error al crear vehículo" }, { status: 500 });
  }
}
