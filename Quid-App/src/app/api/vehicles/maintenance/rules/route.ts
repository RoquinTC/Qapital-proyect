import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getDefaultMaintenanceRules,
  normalizeMaintenanceTypeKey,
} from "@/lib/transport-maintenance-rules";

const ruleSchema = z.object({
  typeKey: z.string().min(1),
  name: z.string().min(1),
  intervalKm: z.number().min(0).nullable().optional(),
  intervalMonths: z.number().int().min(0).nullable().optional(),
  warningKm: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

const rulesUpdateSchema = z.object({
  rules: z.array(ruleSchema).min(1),
});

type MergedMaintenanceRule = {
  id?: string;
  typeKey: string;
  name: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  warningKm: number | null;
  isActive: boolean;
  isDefault: boolean;
};

function mergeRules(
  defaults: ReturnType<typeof getDefaultMaintenanceRules>,
  savedRules: Array<{
    id: string;
    typeKey: string;
    name: string;
    intervalKm: number | null;
    intervalMonths: number | null;
    warningKm: number | null;
    isActive: boolean;
  }>,
  customNames: string[]
) {
  const byKey = new Map<string, MergedMaintenanceRule>(
    defaults.map((rule) => [rule.typeKey, { ...rule }])
  );

  for (const name of customNames) {
    const typeKey = normalizeMaintenanceTypeKey(name);
    if (!byKey.has(typeKey)) {
      byKey.set(typeKey, {
        typeKey,
        name,
        intervalKm: null,
        intervalMonths: null,
        warningKm: 500,
        isActive: false,
        isDefault: false,
      });
    }
  }

  for (const rule of savedRules) {
    byKey.set(rule.typeKey, {
      ...byKey.get(rule.typeKey),
      id: rule.id,
      typeKey: rule.typeKey,
      name: rule.name,
      intervalKm: rule.intervalKm,
      intervalMonths: rule.intervalMonths,
      warningKm: rule.warningKm,
      isActive: rule.isActive,
      isDefault: byKey.get(rule.typeKey)?.isDefault ?? false,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const [savedRules, customItems] = await Promise.all([
      db.maintenanceServiceRule.findMany({
        where: { userId: session.user.id },
        orderBy: { name: "asc" },
      }),
      db.maintenanceItem.findMany({
        where: { maintenanceRecord: { vehicle: { userId: session.user.id } } },
        select: { name: true },
        distinct: ["name"],
      }),
    ]);

    return NextResponse.json(
      mergeRules(
        getDefaultMaintenanceRules(),
        savedRules,
        customItems.map((item) => item.name)
      )
    );
  } catch (error) {
    console.error("Get maintenance rules error:", error);
    return NextResponse.json({ error: "Error al obtener reglas de mantenimiento" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = rulesUpdateSchema.parse(await req.json());
    const updates = body.rules.map((rule) => {
      const typeKey = normalizeMaintenanceTypeKey(rule.typeKey);
      return db.maintenanceServiceRule.upsert({
        where: { userId_typeKey: { userId: session.user.id, typeKey } },
        create: {
          userId: session.user.id,
          typeKey,
          name: rule.name.trim(),
          intervalKm: rule.intervalKm ?? null,
          intervalMonths: rule.intervalMonths ?? null,
          warningKm: rule.warningKm ?? null,
          isActive: rule.isActive,
        },
        update: {
          name: rule.name.trim(),
          intervalKm: rule.intervalKm ?? null,
          intervalMonths: rule.intervalMonths ?? null,
          warningKm: rule.warningKm ?? null,
          isActive: rule.isActive,
        },
      });
    });

    await db.$transaction(updates);
    const savedRules = await db.maintenanceServiceRule.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(savedRules);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Update maintenance rules error:", error);
    return NextResponse.json({ error: "Error al actualizar reglas de mantenimiento" }, { status: 500 });
  }
}
