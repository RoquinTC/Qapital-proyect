import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getColombiaNow } from "@/lib/api";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get current month
    const now = getColombiaNow();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get high-yield accounts
    const highYieldAccounts = await db.account.findMany({
      where: {
        userId: session.user.id,
        isHighYield: true,
      },
      include: {
        yieldHistory: {
          where: { month: monthStart },
        },
      },
    });

    // Get high-yield sub-accounts
    const highYieldSubAccounts = await db.subAccount.findMany({
      where: {
        account: { userId: session.user.id },
        isHighYield: true,
      },
      include: {
        account: { select: { id: true, name: true } },
        yieldHistory: {
          where: { month: monthStart },
        },
      },
    });

    // Calculate projected yields
    const yields = [];

    for (const account of highYieldAccounts) {
      const existingRecord = account.yieldHistory[0];
      const projectedYield = account.balance * ((account.yieldPercentage || 0) / 100) / 12;

      yields.push({
        id: existingRecord?.id || null,
        accountId: account.id,
        subAccountId: null,
        parentAccountId: null, // Not needed for account-level yields
        accountName: account.name,
        balance: account.balance,
        yieldPercentage: account.yieldPercentage || 0,
        projectedYield,
        actualYield: existingRecord?.actualYield || null,
        isConfirmed: existingRecord?.isConfirmed || false,
        transactionId: existingRecord?.transactionId || null,
      });
    }

    for (const subAccount of highYieldSubAccounts) {
      const existingRecord = subAccount.yieldHistory[0];
      const projectedYield = subAccount.balance * ((subAccount.yieldPercentage || 0) / 100) / 12;

      yields.push({
        id: existingRecord?.id || null,
        accountId: null, // Keep null for backward compat (no direct account relation)
        subAccountId: subAccount.id,
        parentAccountId: subAccount.accountId, // ✅ Parent account ID for sub-accounts
        accountName: `${subAccount.account.name} → ${subAccount.name}`,
        balance: subAccount.balance,
        yieldPercentage: subAccount.yieldPercentage || 0,
        projectedYield,
        actualYield: existingRecord?.actualYield || null,
        isConfirmed: existingRecord?.isConfirmed || false,
        transactionId: existingRecord?.transactionId || null,
      });
    }

    return NextResponse.json(yields);
  } catch (error) {
    console.error("Get yields error:", error);
    return NextResponse.json({ error: "Error al obtener rendimientos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, subAccountId, actualYield, yieldPercentage, projectedYield, parentAccountId } = body;

    if (actualYield === undefined) {
      return NextResponse.json({ error: "El rendimiento actual es requerido" }, { status: 400 });
    }

    const now = getColombiaNow();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Determine target account and sub-account for the transaction
    const isSubAccount = !!subAccountId;
    const targetAccountId = isSubAccount ? parentAccountId : accountId;

    if (!targetAccountId) {
      return NextResponse.json(
        { error: "No se pudo determinar la cuenta destino para el rendimiento" },
        { status: 400 }
      );
    }

    // Create or update yield record
    const yieldRecord = await db.yieldRecord.upsert({
      where: {
        id: body.yieldRecordId || "nonexistent",
      },
      create: {
        accountId: accountId || null,
        subAccountId: subAccountId || null,
        month: monthStart,
        projectedYield: projectedYield || 0,
        actualYield,
        yieldPercentage: yieldPercentage || 0,
        isConfirmed: true,
      },
      update: {
        actualYield,
        isConfirmed: true,
      },
    });

    // Add income transaction for the yield
    if (actualYield > 0) {
      const monthLabel = monthStart.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      const description = isSubAccount
        ? `Rendimiento bolsillo - ${monthLabel}`
        : `Rendimiento cuenta - ${monthLabel}`;

      const transaction = await db.transaction.create({
        data: {
          userId: session.user.id,
          accountId: targetAccountId,
          subAccountId: isSubAccount ? subAccountId : null,
          type: "income",
          amount: actualYield,
          description,
          category: "Inversiones",
          date: getColombiaNow(),
          sourceModule: "finance",
          sourceId: yieldRecord.id, // Link to yield record
        },
      });

      // Save transactionId on the yield record
      await db.yieldRecord.update({
        where: { id: yieldRecord.id },
        data: { transactionId: transaction.id },
      });

      // Update balances — only on the specific account or sub-account
      if (isSubAccount) {
        // Only increment sub-account balance
        await db.subAccount.update({
          where: { id: subAccountId },
          data: { balance: { increment: actualYield } },
        });
      } else {
        // Account-level yield: increment account balance
        await db.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: actualYield } },
        });
      }
    }

    return NextResponse.json(yieldRecord);
  } catch (error) {
    console.error("Confirm yield error:", error);
    return NextResponse.json({ error: "Error al confirmar rendimiento" }, { status: 500 });
  }
}
