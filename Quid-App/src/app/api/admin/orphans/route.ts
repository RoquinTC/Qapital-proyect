import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const USER_TABLES = [
  { label: "Account", table: "accounts" },
  { label: "Transaction", table: "transactions" },
  { label: "Budget", table: "budgets" },
  { label: "Debt", table: "debts" },
  { label: "RecurringPayment", table: "recurring_payments" },
  { label: "PayrollGroup", table: "payroll_groups" },
  { label: "SavingsGoal", table: "savings_goals" },
  { label: "CDT", table: "cdts" },
  { label: "Vehicle", table: "vehicles" },
  { label: "VehicleReminder", table: "vehicle_reminders" },
  { label: "Medication", table: "medications" },
  { label: "MedicalAppointment", table: "medical_appointments" },
  { label: "PantryItem", table: "pantry_items" },
  { label: "ShoppingList", table: "shopping_lists" },
  { label: "HealthProfile", table: "health_profiles" },
  { label: "Category", table: "custom_categories" },
  { label: "AppNotification", table: "app_notifications" },
  { label: "PushSubscription", table: "push_subscriptions" },
  { label: "StoredBackup", table: "stored_backups" },
  { label: "AuthCredential", table: "auth_credentials" },
  { label: "AchievementProgress", table: "achievement_progress" },
] as const;

type OrphanRow = { count: bigint | number };
type UserTable = (typeof USER_TABLES)[number];
type OrphanCleanupResult = { table: string; deleted: number };

async function countOrphans(tableName: UserTable) {
  const rows = await db.$queryRawUnsafe<OrphanRow[]>(
    `SELECT COUNT(*) AS count FROM "${tableName.table}" t LEFT JOIN "User" u ON u.id = t."userId" WHERE u.id IS NULL`
  );
  return Number(rows[0]?.count ?? 0);
}

async function deleteOrphans(tableName: UserTable) {
  const rows = await db.$queryRawUnsafe<OrphanRow[]>(
    `WITH deleted AS (
      DELETE FROM "${tableName.table}" t
      WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId")
      RETURNING 1
    )
    SELECT COUNT(*) AS count FROM deleted`
  );
  return Number(rows[0]?.count ?? 0);
}

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const tables = await Promise.all(
      USER_TABLES.map(async (table) => ({
        table: table.label,
        count: await countOrphans(table),
      }))
    );

    return NextResponse.json({
      tables,
      total: tables.reduce((sum, table) => sum + table.count, 0),
    });
  } catch (error) {
    console.error("Admin orphan scan error:", error);
    return NextResponse.json({ error: "Error al auditar registros huérfanos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "LIMPIAR") {
      return NextResponse.json({ error: "Confirmación requerida" }, { status: 400 });
    }

    const tables: OrphanCleanupResult[] = [];
    for (const table of USER_TABLES) {
      tables.push({ table: table.label, deleted: await deleteOrphans(table) });
    }

    return NextResponse.json({
      success: true,
      tables,
      totalDeleted: tables.reduce((sum, table) => sum + table.deleted, 0),
    });
  } catch (error) {
    console.error("Admin orphan cleanup error:", error);
    return NextResponse.json({ error: "Error al limpiar registros huérfanos" }, { status: 500 });
  }
}
