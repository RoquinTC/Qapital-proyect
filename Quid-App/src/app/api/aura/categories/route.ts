import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

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

const defaultIncomeCategories = ["Salario", "Freelance", "Inversiones", "Ventas", "Otros"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const headersList = await headers();
    const auraToken = headersList.get("x-aura-token");
    const isTrustedAuraClient =
      Boolean(process.env.AURA_API_KEY) && auraToken === process.env.AURA_API_KEY;

    console.log(`[Aura Categories API] process.env.AURA_API_KEY: "${process.env.AURA_API_KEY}", auraToken: "${auraToken}", telegramId: "${telegramId}", isTrusted: ${isTrustedAuraClient}`);

    if (!isTrustedAuraClient || !telegramId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const userId = user.id;

    // Obtener budgets
    const budgets = await db.budget.findMany({
      where: { userId },
      select: { category: true, subCategory: true },
    });

    // Obtener transacciones con categorías/subcategorías
    const transactions = await db.transaction.findMany({
      where: { userId, category: { not: null } },
      select: { category: true, subCategory: true },
    });

    // Obtener categorías personalizadas
    const customCategories = await db.category.findMany({
      where: { userId },
    });

    // Construir el mapa de categorías y subcategorías
    const map: Record<string, Set<string>> = {};

    // 1. Agregar defaults
    const hiddenDefaults = new Set(
      customCategories
        .filter((c) => c.hidden)
        .map((c) => c.name)
    );

    for (const cat of [...defaultExpenseCategories, ...defaultIncomeCategories]) {
      if (!hiddenDefaults.has(cat)) {
        if (!map[cat]) map[cat] = new Set();
      }
    }

    // 2. Agregar personalizadas
    for (const cc of customCategories) {
      if (!cc.hidden) {
        if (!map[cc.name]) map[cc.name] = new Set();
      }
    }

    // 3. Agregar desde budgets
    for (const b of budgets) {
      if (!map[b.category]) map[b.category] = new Set();
      if (b.subCategory) {
        map[b.category].add(b.subCategory);
      }
    }

    // 4. Agregar desde transacciones
    for (const t of transactions) {
      if (t.category) {
        if (!map[t.category]) map[t.category] = new Set();
        if (t.subCategory) {
          map[t.category].add(t.subCategory);
        }
      }
    }

    // Convertir sets a arrays ordenados
    const categories: Record<string, string[]> = {};
    for (const cat of Object.keys(map)) {
      categories[cat] = Array.from(map[cat]).sort();
    }

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error("Error en /api/aura/categories:", error);
    return NextResponse.json(
      { error: error.message || "Error interno obteniendo categorías." },
      { status: 500 }
    );
  }
}
