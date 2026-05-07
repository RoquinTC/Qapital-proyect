import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete all finance data for this user (order matters due to foreign keys)
    await db.savingsContribution.deleteMany({ where: { goal: { userId } } });
    await db.savingsGoalAccount.deleteMany({ where: { goal: { userId } } });
    await db.savingsGoal.deleteMany({ where: { userId } });
    await db.cdt.deleteMany({ where: { userId } });
    await db.installment.deleteMany({ where: { debt: { userId } } });
    await db.recurringPayment.deleteMany({ where: { userId } });
    await db.debt.deleteMany({ where: { userId } });
    await db.transaction.deleteMany({ where: { userId } });
    await db.budget.deleteMany({ where: { userId } });
    await db.yieldRecord.deleteMany({ where: { account: { userId } } });
    await db.sharedAccountUser.deleteMany({ where: { account: { userId } } });
    await db.subAccount.deleteMany({ where: { account: { userId } } });
    await db.account.deleteMany({ where: { userId } });

    return NextResponse.json({ success: true, message: "Todos los datos financieros han sido eliminados" });
  } catch (error) {
    console.error("Reset all data error:", error);
    return NextResponse.json({ error: "Error al eliminar los datos" }, { status: 500 });
  }
}
