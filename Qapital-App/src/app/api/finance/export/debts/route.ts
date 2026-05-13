import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/decimal-serializer";
import * as XLSX from "xlsx";
import { toColombiaDateString } from "@/lib/api";

const debtTypeLabels: Record<string, string> = {
  credit_card: "Tarjeta Crédito",
  loan: "Préstamo",
  other: "Otro",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    const debts = await db.debt.findMany({
      where: { userId },
      include: { installments: { orderBy: { currentInstallment: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    const wb = XLSX.utils.book_new();

    // ===== Sheet 1: Resumen Deudas =====
    const summaryHeaders = [
      "Deuda",
      "Tipo",
      "Banco",
      "Monto Total",
      "Saldo Actual",
      "Cuota Mensual",
      "Pagos Restantes",
      "Próx. Pago",
      "Tasa Interés",
    ];

    const summaryRows = debts.map((debt) => {
      // Find nearest future nextPaymentDate from installments
      const now = new Date();
      const pendingInstallments = debt.installments.filter(
        (i) => !i.isPaid && new Date(i.nextPaymentDate) > now
      );
      const nextPayment =
        pendingInstallments.length > 0
          ? pendingInstallments.sort(
              (a, b) =>
                new Date(a.nextPaymentDate).getTime() -
                new Date(b.nextPaymentDate).getTime()
            )[0].nextPaymentDate
          : null;

      return [
        debt.name,
        debtTypeLabels[debt.type] || debt.type,
        debt.bank || "",
        toNumber(debt.totalAmount),
        toNumber(debt.currentBalance),
        debt.monthlyPayment ? toNumber(debt.monthlyPayment) : "",
        debt.remainingPayments || "",
        nextPayment ? toColombiaDateString(nextPayment) : "",
        debt.interestRate ? `${toNumber(debt.interestRate)}%` : "",
      ];
    });

    const wsSummary = XLSX.utils.aoa_to_sheet([
      summaryHeaders,
      ...summaryRows,
    ]);
    wsSummary["!cols"] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Deudas");

    // ===== Sheet 2: Detalle Cuotas =====
    const detailHeaders = [
      "Deuda",
      "Compra",
      "Cuota #",
      "Total Cuotas",
      "Fecha Próx. Pago",
      "Monto Cuota",
      "Pagado",
      "Saldo Restante",
      "Estado",
    ];

    const detailRows: (string | number)[][] = [];

    for (const debt of debts) {
      for (const inst of debt.installments) {
        detailRows.push([
          debt.name,
          inst.description,
          inst.currentInstallment,
          inst.totalInstallments,
          toColombiaDateString(inst.nextPaymentDate),
          toNumber(inst.installmentAmount),
          toNumber(inst.paidAmount),
          inst.remainingBalance ? toNumber(inst.remainingBalance) : "",
          inst.isPaid ? "Pagada" : "Pendiente",
        ]);
      }
    }

    const wsDetail = XLSX.utils.aoa_to_sheet([
      detailHeaders,
      ...detailRows,
    ]);
    wsDetail["!cols"] = [
      { wch: 22 },
      { wch: 25 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle Cuotas");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const today = new Date().toISOString().split("T")[0];
    const filename = `qapital-deudas-${today}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Debts export error:", error);
    return NextResponse.json(
      { error: "Error al exportar deudas" },
      { status: 500 }
    );
  }
}
