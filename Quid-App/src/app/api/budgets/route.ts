import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateBody, budgetCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const budgets = await db.budget.findMany({
      where: { userId: session.user.id },
      orderBy: [{ type: "asc" }, { category: "asc" }],
    });

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Get budgets error:", error);
    return NextResponse.json({ error: "Error al obtener presupuestos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Read sumIfExists from cloned request to not consume the stream
    const cloneReq = req.clone();
    let sumIfExists = false;
    try {
      const raw = await cloneReq.json();
      sumIfExists = raw.sumIfExists === true;
    } catch (e) {
      // Ignore JSON parse errors here; validateBody will handle them
    }

    const body = await validateBody(req, budgetCreateSchema);
    const { type, category, subCategory, amount, period, icon, color } = body;

    if (!type || !category || !amount) {
      return NextResponse.json({ error: "Tipo, categoría y monto son requeridos" }, { status: 400 });
    }

    // Check if budget already exists for this category
    const existing = await db.budget.findFirst({
      where: {
        userId: session.user.id,
        type,
        category,
        subCategory: subCategory || null,
      },
    });

    if (existing) {
      if (sumIfExists) {
        const budget = await db.budget.update({
          where: { id: existing.id },
          data: {
            amount: { increment: amount },
          },
        });
        return NextResponse.json(budget, { status: 200 });
      }
      return NextResponse.json({ error: "Ya existe un presupuesto para esta categoría" }, { status: 409 });
    }

    const budget = await db.budget.create({
      data: {
        userId: session.user.id,
        type,
        category,
        subCategory: subCategory || null,
        amount,
        spent: 0,
        period: period || "monthly",
        icon,
        color,
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create budget error:", error);
    return NextResponse.json({ error: "Error al crear presupuesto" }, { status: 500 });
  }
}
