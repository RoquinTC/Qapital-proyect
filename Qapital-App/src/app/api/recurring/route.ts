import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const recurringPayments = await db.recurringPayment.findMany({
      where: { userId: session.user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            balance: true,
          },
        },
        subAccount: {
          select: {
            id: true,
            name: true,
          },
        },
        debt: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            currentBalance: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Manually resolve destination accounts for any transfer-type payments
    const enriched = await Promise.all(
      recurringPayments.map(async (payment) => {
        let destinationAccount = null;
        if (payment.destinationAccountId) {
          const acc = await db.account.findUnique({
            where: { id: payment.destinationAccountId },
            select: { id: true, name: true, type: true, color: true, balance: true },
          });
          destinationAccount = acc;
        }
        return { ...payment, destinationAccount };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Get recurring payments error:", error);
    return NextResponse.json(
      { error: "Error al obtener pagos recurrentes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      description,
      amount,
      type,
      accountId,
      subAccountId,
      debtId,
      destinationAccountId,
      destinationSubAccountId,
      category,
      subCategory,
      scheduledDate,
      frequency,
      notes,
      isRecurring,
    } = body;

    if (!description || amount === undefined || !scheduledDate) {
      return NextResponse.json(
        { error: "Descripción, monto y fecha programada son requeridos" },
        { status: 400 }
      );
    }

    const recurringPayment = await db.recurringPayment.create({
      data: {
        userId: session.user.id,
        description,
        amount,
        type: type || "expense",
        accountId: accountId || null,
        subAccountId: subAccountId || null,
        debtId: debtId || null,
        destinationAccountId: destinationAccountId || null,
        destinationSubAccountId: destinationSubAccountId || null,
        category: category || null,
        subCategory: subCategory || null,
        scheduledDate: new Date(scheduledDate),
        frequency: frequency || "monthly",
        notes: notes || null,
        isRecurring: isRecurring !== undefined ? isRecurring : true,
        status: "pending",
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            balance: true,
          },
        },
        subAccount: {
          select: {
            id: true,
            name: true,
          },
        },
        debt: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            currentBalance: true,
          },
        },
      },
    });

    return NextResponse.json(recurringPayment, { status: 201 });
  } catch (error) {
    console.error("Create recurring payment error:", error);
    return NextResponse.json(
      { error: "Error al crear pago recurrente" },
      { status: 500 }
    );
  }
}
