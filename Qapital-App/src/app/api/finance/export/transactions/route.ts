import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/decimal-serializer";
import * as XLSX from "xlsx";
import { createColombiaDate, toColombiaDateString } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const accountId = searchParams.get("accountId");
    const category = searchParams.get("category");
    const type = searchParams.get("type");

    // Build where clause
    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const s = createColombiaDate(startDate);
        where.date.gte = s;
      }
      if (endDate) {
        const e = createColombiaDate(endDate);
        e.setUTCHours(23, 59, 59, 999);
        where.date.lte = e;
      }
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (category) {
      where.category = category;
    }

    if (type && ["income", "expense", "transfer"].includes(type)) {
      where.type = type;
    }

    // Fetch all matching transactions
    const transactions = await db.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true } },
        subAccount: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    // Fetch related transactions for transfers (to get destination account)
    const transferSourceIds = transactions
      .filter((t) => t.type === "transfer" && t.relatedTransactionId)
      .map((t) => t.relatedTransactionId!);

    let relatedMap = new Map<string, { accountId: string | null; accountName: string; subAccountName: string | null }>();

    if (transferSourceIds.length > 0) {
      const relatedTxs = await db.transaction.findMany({
        where: { id: { in: transferSourceIds } },
        include: {
          account: { select: { name: true } },
          subAccount: { select: { name: true } },
        },
      });

      for (const rt of relatedTxs) {
        relatedMap.set(rt.id, {
          accountId: rt.accountId,
          accountName: rt.account?.name || "",
          subAccountName: rt.subAccount?.name || null,
        });
      }
    }

    // Separate by type
    const incomes = transactions.filter((t) => t.type === "income" && !t.relatedTransactionId);
    const expenses = transactions.filter((t) => t.type === "expense");
    const transfers = transactions.filter((t) => t.type === "transfer");

    // Also include income records that are transfer counterparts
    const transferCounterparts = transactions.filter(
      (t) => t.type === "income" && t.relatedTransactionId
    );

    const wb = XLSX.utils.book_new();

    // ===== Sheet 1: Ingresos =====
    const ingresosData = incomes.map((t) => [
      toColombiaDateString(t.date),
      t.description,
      toNumber(t.amount),
      t.category || "",
      t.subCategory || "",
      t.account?.name || "",
      t.subAccount?.name || "",
      t.notes || "",
    ]);

    const ingresosHeaders = [
      "Fecha",
      "Descripción",
      "Monto",
      "Categoría",
      "Subcategoría",
      "Cuenta",
      "Subcuenta",
      "Notas",
    ];

    const wsIngresos = XLSX.utils.aoa_to_sheet([
      ingresosHeaders,
      ...ingresosData,
    ]);
    wsIngresos["!cols"] = [
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsIngresos, "Ingresos");

    // ===== Sheet 2: Gastos =====
    const gastosData = expenses.map((t) => [
      toColombiaDateString(t.date),
      t.description,
      toNumber(t.amount),
      t.category || "",
      t.subCategory || "",
      t.account?.name || "",
      t.subAccount?.name || "",
      t.notes || "",
    ]);

    const wsGastos = XLSX.utils.aoa_to_sheet([
      ingresosHeaders,
      ...gastosData,
    ]);
    wsGastos["!cols"] = wsIngresos["!cols"];
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");

    // ===== Sheet 3: Transferencias =====
    const transferHeaders = [
      "Fecha",
      "Descripción",
      "Monto",
      "Cuenta Origen",
      "Subcuenta Origen",
      "Cuenta Destino",
      "Subcuenta Destino",
      "Notas",
    ];

    const transferenciasData = transfers.map((t) => {
      const dest = t.relatedTransactionId
        ? relatedMap.get(t.relatedTransactionId)
        : null;

      return [
        toColombiaDateString(t.date),
        t.description,
        toNumber(t.amount),
        t.account?.name || "",
        t.subAccount?.name || "",
        dest?.accountName || "",
        dest?.subAccountName || "",
        t.notes || "",
      ];
    });

    const wsTransferencias = XLSX.utils.aoa_to_sheet([
      transferHeaders,
      ...transferenciasData,
    ]);
    wsTransferencias["!cols"] = [
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTransferencias, "Transferencias");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const today = new Date().toISOString().split("T")[0];
    const filename = `qapital-movimientos-${today}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Transaction export error:", error);
    return NextResponse.json(
      { error: "Error al exportar movimientos" },
      { status: 500 }
    );
  }
}
