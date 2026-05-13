import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/decimal-serializer";
import * as XLSX from "xlsx";

const accountTypeLabels: Record<string, string> = {
  checking: "Corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  digital_wallet: "Billetera Digital",
  other: "Otro",
};

const subAccountTypeLabels: Record<string, string> = {
  pocket: "Bolsillo",
  piggy_bank: "Alcancía",
  savings_box: "Caja de Ahorros",
  other: "Otro",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    const accounts = await db.account.findMany({
      where: { userId },
      include: { subAccounts: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });

    const wb = XLSX.utils.book_new();

    // Build rows
    const rows: (string | number)[][] = [["Cuenta", "Subcuenta", "Tipo", "Balance"]];

    let totalBalance = 0;

    for (const account of accounts) {
      const balance = toNumber(account.balance);
      totalBalance += balance;

      // Account row
      rows.push([
        account.name,
        "",
        accountTypeLabels[account.type] || account.type,
        balance,
      ]);

      // SubAccount rows
      for (const sub of account.subAccounts) {
        const subBalance = toNumber(sub.balance);
        rows.push([
          "",
          sub.name,
          subAccountTypeLabels[sub.type] || sub.type,
          subBalance,
        ]);
      }
    }

    // Total row
    rows.push(["TOTAL GENERAL", "", "", totalBalance]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Balances");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const today = new Date().toISOString().split("T")[0];
    const filename = `qapital-balances-${today}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Balances export error:", error);
    return NextResponse.json(
      { error: "Error al exportar balances" },
      { status: 500 }
    );
  }
}
