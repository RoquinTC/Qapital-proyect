import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Default categories that always appear
const defaultIncomeCategories = ["Salario", "Freelance", "Inversiones", "Ventas", "Otros"];
const defaultExpenseCategories = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Salud",
  "Entretenimiento",
  "Educación",
  "Ropa",
  "Servicios",
  "Deudas",
  "Ahorros",
  "Suscripciones",
  "Otros",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "income" or "expense"

    // Get all unique (category, subCategory) pairs from user's budgets
    const budgets = await db.budget.findMany({
      where: {
        userId: session.user.id,
        ...(type ? { type } : {}),
      },
      select: { category: true, subCategory: true, type: true },
      distinct: ["category", "subCategory"],
    });

    // Get all unique (category, subCategory) pairs from user's transactions
    const transactions = await db.transaction.findMany({
      where: {
        userId: session.user.id,
        category: { not: null },
        ...(type ? { type } : {}),
      },
      select: { category: true, subCategory: true, type: true },
      distinct: ["category", "subCategory"],
    });

    // Build a map of category -> Set of subcategories
    const categoryMap: Record<string, Record<string, Set<string>>> = {
      income: {},
      expense: {},
    };

    // Add defaults
    for (const cat of defaultIncomeCategories) {
      categoryMap.income[cat] = new Set();
    }
    for (const cat of defaultExpenseCategories) {
      categoryMap.expense[cat] = new Set();
    }

    // Merge budget categories
    for (const b of budgets) {
      const t = b.type as "income" | "expense";
      if (!categoryMap[t]) categoryMap[t] = {};
      if (!categoryMap[t][b.category]) categoryMap[t][b.category] = new Set();
      if (b.subCategory) categoryMap[t][b.category].add(b.subCategory);
    }

    // Merge transaction categories
    for (const tx of transactions) {
      if (!tx.category) continue;
      const t = (tx.type as "income" | "expense") || "expense";
      if (!categoryMap[t]) categoryMap[t] = {};
      if (!categoryMap[t][tx.category]) categoryMap[t][tx.category] = new Set();
      if (tx.subCategory) categoryMap[t][tx.category].add(tx.subCategory);
    }

    // Convert Sets to sorted arrays
    const result: Record<string, Array<{ name: string; subcategories: string[] }>> = {
      income: Object.entries(categoryMap.income)
        .map(([name, subs]) => ({ name, subcategories: Array.from(subs).sort() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      expense: Object.entries(categoryMap.expense)
        .map(([name, subs]) => ({ name, subcategories: Array.from(subs).sort() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
  }
}
