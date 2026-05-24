import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/decimal-serializer";

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

type EmergencySuggestionOptions = {
  coverageMonths?: unknown;
  monthsToBuild?: unknown;
  contributionRate?: unknown;
};

async function buildEmergencySuggestion(userId: string, options: EmergencySuggestionOptions = {}) {
  const now = new Date();
  const since = new Date(now);
  since.setDate(now.getDate() - 90);
  const coverageMonths = clampInteger(options.coverageMonths, 3, 1, 12);
  const monthsToBuild = clampInteger(options.monthsToBuild, 6, 1, 36);
  const contributionRate = clampNumber(options.contributionRate, 10, 1, 50);

  const [expenseTransactions, incomeTransactions, recurring, existingGoal, accounts] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        type: "expense",
        date: { gte: since },
        category: { notIn: ["Ahorros", "Transferencias"] },
        OR: [{ excludeFromBudget: false }, { excludeFromBudget: { equals: null } }],
      },
      select: { amount: true },
    }),
    db.transaction.findMany({
      where: {
        userId,
        type: "income",
        date: { gte: since },
        category: { notIn: ["Ahorros", "Transferencias"] },
        OR: [{ excludeFromBudget: false }, { excludeFromBudget: { equals: null } }],
      },
      select: { amount: true },
    }),
    db.recurringPayment.findMany({
      where: {
        userId,
        status: "pending",
        type: "expense",
        category: { notIn: ["Ahorros", "Transferencias"] },
      },
      select: { amount: true },
    }),
    db.savingsGoal.findFirst({
      where: { userId, type: "emergency_fund", isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    db.account.findMany({
      where: { userId },
      select: {
        balance: true,
        type: true,
        excludeFromAvailable: true,
        subAccounts: {
          select: {
            balance: true,
            excludeFromAvailable: true,
          },
        },
      },
    }),
  ]);

  const recentExpenses = expenseTransactions.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const recentRealIncome = incomeTransactions.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const averageMonthlyExpenses = Math.round(recentExpenses / 3);
  const averageMonthlyRealIncome = Math.round(recentRealIncome / 3);
  const fixedMonthlyExpenses = recurring.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const monthlyNeed = Math.max(averageMonthlyExpenses, fixedMonthlyExpenses);
  const recommendedTarget = Math.max(500000, Math.round(monthlyNeed * coverageMonths));
  const availableBalance = accounts.reduce((sum, account) => {
    const accountBalance = account.excludeFromAvailable ? 0 : toNumber(account.balance);
    const subAccountBalance = account.subAccounts.reduce(
      (subSum, subAccount) => subAccount.excludeFromAvailable ? subSum : subSum + toNumber(subAccount.balance),
      0,
    );
    return sum + accountBalance + subAccountBalance;
  }, 0);
  const currentEmergencyLiquidity = accounts.reduce((sum, account) => {
    const isLiquid = ["savings", "cash", "digital_wallet"].includes(account.type);
    const accountBalance = isLiquid && !account.excludeFromAvailable ? toNumber(account.balance) : 0;
    const subAccountBalance = isLiquid
      ? account.subAccounts.reduce(
          (subSum, subAccount) => subAccount.excludeFromAvailable ? subSum : subSum + toNumber(subAccount.balance),
          0,
        )
      : 0;
    return sum + accountBalance + subAccountBalance;
  }, 0);
  const gap = Math.max(0, recommendedTarget - toNumber(existingGoal?.currentAmount ?? 0));
  const gapMonthlyContribution = Math.ceil(gap / monthsToBuild);
  const incomeBasedContribution = averageMonthlyRealIncome > 0
    ? Math.ceil(averageMonthlyRealIncome * (contributionRate / 100))
    : 0;
  const monthlyContribution = gapMonthlyContribution;
  const contributionWarning = incomeBasedContribution > 0 && monthlyContribution > incomeBasedContribution
    ? `Este aporte supera el ${contributionRate}% de tu ingreso real promedio (${incomeBasedContribution.toLocaleString("es-CO")} COP); puedes aumentar el plazo si quieres una cuota más suave.`
    : `El aporte queda dentro del ${contributionRate}% de tu ingreso real promedio.`;
  const aiSuggestion = monthlyNeed > 0
    ? `Tu colchón recomendado es de ${coverageMonths} meses de gastos esenciales. La meta sugerida es ${recommendedTarget.toLocaleString("es-CO")} COP y para construirla en ${monthsToBuild} meses necesitas aportes mensuales de ${monthlyContribution.toLocaleString("es-CO")} COP. ${contributionWarning} Para el ingreso real se excluyen transferencias internas y movimientos marcados fuera de presupuesto.`
    : "Aún no hay suficiente historial de gastos. Quid propone una meta base mientras registras más movimientos.";

  return {
    existingGoalId: existingGoal?.id ?? null,
    recommendedTarget,
    currentEmergencyLiquidity,
    availableBalance,
    averageMonthlyExpenses,
    averageMonthlyRealIncome,
    fixedMonthlyExpenses,
    monthlyNeed,
    coverageMonths,
    monthsToBuild,
    contributionRate,
    incomeBasedContribution,
    gapMonthlyContribution,
    gap,
    monthlyContribution,
    recommendedDeadline: addMonths(now, monthsToBuild).toISOString(),
    aiSuggestion,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    return NextResponse.json(await buildEmergencySuggestion(session.user.id, {
      coverageMonths: params.get("coverageMonths"),
      monthsToBuild: params.get("monthsToBuild"),
      contributionRate: params.get("contributionRate"),
    }));
  } catch (error: any) {
    console.error("Emergency suggestion error:", error);
    return NextResponse.json({ error: error.message || "Error calculando fondo de emergencia" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Configura el fondo desde el formulario de metas para crear también los pagos recurrentes." },
    { status: 405 },
  );
}
