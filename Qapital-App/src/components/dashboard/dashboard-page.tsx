"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  PiggyBank,
  Receipt,
  Calendar,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { formatCurrency, apiFetch, calcPercentage } from "@/lib/api";
import { motion } from "framer-motion";

interface SubAccount {
  id: string;
  name: string;
  balance: number;
  excludeFromAvailable?: boolean;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  color: string;
  excludeFromAvailable?: boolean;
  subAccounts: SubAccount[];
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  category?: string | null;
  date: string;
  account?: { id: string; name: string; color: string } | null;
}

interface Budget {
  id: string;
  type: string;
  category: string;
  amount: number;
  spent: number;
}

interface Debt {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  monthlyPayment?: number | null;
  paymentDate?: number | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const { setActiveModule, setFinanceSubView } = useAppStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [accs, txs, bdgs, dbts] = await Promise.allSettled([
        apiFetch<Account[]>("/api/accounts"),
        apiFetch<Transaction[]>("/api/transactions"),
        apiFetch<Budget[]>("/api/budgets"),
        apiFetch<Debt[]>("/api/debts"),
      ]);

      if (accs.status === "fulfilled") setAccounts(accs.value);
      if (txs.status === "fulfilled") setTransactions(txs.value);
      if (bdgs.status === "fulfilled") setBudgets(bdgs.value);
      if (dbts.status === "fulfilled") setDebts(dbts.value);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute real data — account.balance and subAccount.balance are SEPARATE
  // (a transaction on a sub-account only updates subAccount.balance, never account.balance)
  const totalAccountBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalSubAccountBalance = accounts.reduce(
    (sum, a) => sum + a.subAccounts.reduce((s, sa) => s + sa.balance, 0), 0
  );
  const totalBalance = totalAccountBalance + totalSubAccountBalance;

  const incomeBudgets = budgets.filter((b) => b.type === "income");
  const expenseBudgets = budgets.filter((b) => b.type === "expense");
  const monthlyIncome = incomeBudgets.reduce((sum, b) => sum + b.spent, 0);
  const monthlyExpenses = expenseBudgets.reduce((sum, b) => sum + b.spent, 0);
  const totalExpenseBudget = expenseBudgets.reduce((sum, b) => sum + b.amount, 0);
  const budgetUsage = totalExpenseBudget > 0
    ? calcPercentage(monthlyExpenses, totalExpenseBudget)
    : 0;

  const recentTransactions = transactions.slice(0, 5);

  // Expense categories for chart — aggregate by category to avoid duplicate keys
  const expenseByCategory = (() => {
    const categoryMap = new Map<string, { name: string; amount: number; color: string }>();
    for (const b of expenseBudgets) {
      const existing = categoryMap.get(b.category);
      if (existing) {
        existing.amount += b.spent;
      } else {
        categoryMap.set(b.category, {
          name: b.category,
          amount: b.spent,
          color: b.category === "Vivienda" ? "#10B981"
            : b.category === "Alimentación" ? "#F59E0B"
            : b.category === "Transporte" ? "#3B82F6"
            : b.category === "Entretenimiento" ? "#8B5CF6"
            : b.category === "Ahorros" ? "#8B5CF6"
            : b.category === "Suscripciones" ? "#EC4899"
            : "#6B7280",
        });
      }
    }
    return Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      percentage: totalExpenseBudget > 0 ? calcPercentage(cat.amount, totalExpenseBudget) : 0,
    }));
  })();

  // Upcoming bills from debts
  const upcomingBills = debts
    .filter((d) => d.currentBalance > 0)
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      name: d.name,
      amount: d.monthlyPayment || d.currentBalance,
      dueDate: d.paymentDate ? `Día ${d.paymentDate}` : "Próximo",
    }));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4 pb-24"
    >
      {/* Greeting */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold text-gray-900">¡Hola! 👋</h2>
        <p className="text-sm text-gray-500">Aquí está tu resumen de hoy</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="size-4 text-emerald-200" />
              <span className="text-sm text-emerald-100">Balance Total</span>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalBalance)}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="size-3.5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-200">Ingresos</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(monthlyIncome)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowDownRight className="size-3.5 text-rose-200" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-200">Gastos</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(monthlyExpenses)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 mb-1.5">
              <Receipt className="size-4 text-white" />
            </div>
            <p className="text-xs text-gray-500">Presupuesto</p>
            <p className="text-lg font-bold text-gray-900">{budgetUsage}%</p>
            <Progress value={budgetUsage} className="h-1.5 mt-1 rounded-full" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-400 mb-1.5">
              <CreditCard className="size-4 text-white" />
            </div>
            <p className="text-xs text-gray-500">Deudas</p>
            <p className="text-lg font-bold text-gray-900">
              {debts.filter((d) => d.currentBalance > 0).length}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Activas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="inline-flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-400 mb-1.5">
              <PiggyBank className="size-4 text-white" />
            </div>
            <p className="text-xs text-gray-500">Ahorro</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(Math.max(monthlyIncome - monthlyExpenses, 0))}
            </p>
            <p className="text-[10px] text-emerald-500 mt-0.5">Este mes</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400"
            onClick={() => {
              setActiveModule("finance");
              setFinanceSubView("accounts");
            }}
          >
            <Plus className="size-4 mr-1" />
            Transacción
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl border-dashed border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400"
            onClick={() => {
              setActiveModule("finance");
              setFinanceSubView("accounts");
            }}
          >
            <TrendingDown className="size-4 mr-1" />
            Gasto
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-400"
            onClick={() => {
              setActiveModule("finance");
              setFinanceSubView("budgets");
            }}
          >
            <Receipt className="size-4 mr-1" />
            Presupuesto
          </Button>
        </div>
      </motion.div>

      {/* Expense Categories - Mini chart */}
      {expenseByCategory.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-500" />
                Gastos por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {expenseByCategory.some((c) => c.amount > 0) ? (
                <>
                  {/* Visual bar chart */}
                  <div className="flex items-end gap-1 h-20 mb-3">
                    {expenseByCategory.map((cat, i) => (
                      <motion.div
                        key={`bar-${cat.name}-${i}`}
                        className="flex-1 rounded-t-lg"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(cat.percentage, 5)}%` }}
                        transition={{ delay: 0.1 * i, duration: 0.5, ease: "easeOut" }}
                        style={{ backgroundColor: cat.color }}
                      />
                    ))}
                  </div>
                  {/* Category list */}
                  <div className="space-y-2">
                    {expenseByCategory.map((cat, i) => (
                      <div key={`cat-${cat.name}-${i}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs text-gray-600">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-900">
                            {formatCurrency(cat.amount)}
                          </span>
                          <span className="text-[10px] text-gray-400">{cat.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Agrega presupuestos para ver tus gastos por categoría
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-emerald-500" />
                Transacciones Recientes
              </CardTitle>
              <button
                onClick={() => {
                  setActiveModule("finance");
                  setFinanceSubView("accounts");
                }}
                className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
              >
                Ver todo <ChevronRight className="size-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Sin transacciones aún
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-9 rounded-xl flex items-center justify-center ${
                          tx.type === "income"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {tx.type === "income" ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowDownRight className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tx.description}
                        </p>
                        <p className="text-[10px] text-gray-400">{tx.category || "Sin categoría"}</p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.type === "income" ? "text-emerald-600" : "text-gray-900"
                      }`}
                    >
                      {tx.type === "income" ? "+" : ""}
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming Bills */}
      {upcomingBills.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-rose-500" />
                Próximos Pagos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-3">
                {upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 bg-rose-50/60 rounded-xl cursor-pointer"
                    onClick={() => {
                      setActiveModule("finance");
                      setFinanceSubView("debts");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center">
                        <CreditCard className="size-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {bill.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Vence: {bill.dueDate}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-rose-600">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}


    </motion.div>
  );
}
