"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch, formatCurrency, calculateProportionalYield, getDaysInMonth } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calculator,
  TrendingUp,
  Wallet,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Trophy,
  Landmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────
interface HighYieldAccount {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  balance: number;
  yieldPercentage: number;
  subAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    yieldPercentage: number;
    color?: string | null;
    icon?: string | null;
  }>;
}

interface HypotheticalAccount {
  id: string;
  name: string;
  ea: number;
}

// ─── Component ────────────────────────────────────────
export function YieldSimulator() {
  const { setFinanceSubView } = useAppStore();
  const [accounts, setAccounts] = useState<HighYieldAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulateAmount, setSimulateAmount] = useState("");
  const [hypotheticalAccounts, setHypotheticalAccounts] = useState<HypotheticalAccount[]>([]);
  const [newHypName, setNewHypName] = useState("");
  const [newHypEA, setNewHypEA] = useState("");

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await apiFetch<HighYieldAccount[]>("/api/accounts");
      // Filter to only high-yield accounts (and include sub-accounts that are high-yield)
      const highYield = data.filter(
        (a) => a.yieldPercentage && a.yieldPercentage > 0
      );
      setAccounts(highYield);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Calculate days remaining in current month
  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const daysRemaining = daysInMonth - now.getDate() + 1;
  const amount = parseFloat(simulateAmount) || 0;

  // Calculate yields for each real account
  const accountResults = useMemo(() => {
    return accounts.map((account) => {
      const currentYield = calculateProportionalYield(
        account.balance,
        account.yieldPercentage,
        daysRemaining
      );
      const combinedBalance = account.balance + amount;
      const combinedYield = calculateProportionalYield(
        combinedBalance,
        account.yieldPercentage,
        daysRemaining
      );
      const extraYield = combinedYield - currentYield;
      const standaloneYield = calculateProportionalYield(
        amount,
        account.yieldPercentage,
        daysRemaining
      );

      return {
        ...account,
        currentYield,
        combinedYield,
        extraYield,
        standaloneYield,
        combinedBalance,
      };
    });
  }, [accounts, amount, daysRemaining]);

  // Calculate yields for hypothetical accounts
  const hypotheticalResults = useMemo(() => {
    return hypotheticalAccounts.map((hyp) => {
      const standaloneYield = calculateProportionalYield(
        amount,
        hyp.ea,
        daysRemaining
      );
      const fullMonthYield = calculateProportionalYield(
        amount,
        hyp.ea,
        daysInMonth
      );
      return {
        ...hyp,
        standaloneYield,
        fullMonthYield,
      };
    });
  }, [hypotheticalAccounts, amount, daysRemaining, daysInMonth]);

  // Find best options
  const allOptions = useMemo(() => {
    const options: Array<{
      name: string;
      ea: number;
      yield: number;
      type: "combined" | "standalone" | "hypothetical";
      color: string;
    }> = [];

    for (const acc of accountResults) {
      options.push({
        name: acc.name,
        ea: acc.yieldPercentage,
        yield: acc.extraYield,
        type: "combined",
        color: acc.color,
      });
      options.push({
        name: acc.name,
        ea: acc.yieldPercentage,
        yield: acc.standaloneYield,
        type: "standalone",
        color: acc.color,
      });
    }

    for (const hyp of hypotheticalResults) {
      options.push({
        name: hyp.name,
        ea: hyp.ea,
        yield: hyp.standaloneYield,
        type: "hypothetical",
        color: "#6B7280",
      });
    }

    return options.sort((a, b) => b.yield - a.yield);
  }, [accountResults, hypotheticalResults]);

  const bestCombined = allOptions.find((o) => o.type === "combined");
  const bestStandalone = allOptions.find((o) => o.type !== "combined");

  // Add hypothetical account
  const handleAddHypothetical = () => {
    if (!newHypName.trim()) {
      toast.error("Ingresa un nombre para la cuenta");
      return;
    }
    if (!newHypEA || parseFloat(newHypEA) <= 0) {
      toast.error("Ingresa un % EA válido");
      return;
    }
    setHypotheticalAccounts((prev) => [
      ...prev,
      {
        id: `hyp-${Date.now()}`,
        name: newHypName.trim(),
        ea: parseFloat(newHypEA),
      },
    ]);
    setNewHypName("");
    setNewHypEA("");
  };

  // Remove hypothetical account
  const handleRemoveHypothetical = (id: string) => {
    setHypotheticalAccounts((prev) => prev.filter((h) => h.id !== id));
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-4 pb-24"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl shrink-0"
          onClick={() => setFinanceSubView("overview")}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Simulador de Rendimiento
          </h1>
          <p className="text-xs text-gray-400">
            Calcula cuánto podrías recibir a fin de mes
          </p>
        </div>
      </div>

      {/* Amount Input */}
      <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="size-4 text-emerald-200" />
            <span className="text-sm text-emerald-100">Monto a simular</span>
          </div>
          <CurrencyInput
            value={simulateAmount}
            onChange={setSimulateAmount}
            showPrefix
            placeholder="0"
            className="rounded-xl text-2xl font-bold h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-emerald-200">
              Días restantes del mes: {daysRemaining} de {daysInMonth}
            </span>
            {amount > 0 && (
              <span className="text-[10px] text-emerald-200">
                Cálculo proporcional a {daysRemaining} días
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Real Accounts */}
      {accountResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Mis cuentas de alto rendimiento
            </h2>
          </div>

          {accountResults.map((acc) => (
            <Card
              key={acc.id}
              className="border-0 shadow-md rounded-2xl overflow-hidden"
            >
              <div
                className="px-4 py-3"
                style={{
                  background: `linear-gradient(135deg, ${acc.color}15, ${acc.color}08)`,
                  borderLeft: `4px solid ${acc.color}`,
                }}
              >
                {/* Account name + EA */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${acc.color}20` }}
                    >
                      <Landmark
                        className="size-3.5"
                        style={{ color: acc.color }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {acc.name}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: `${acc.color}20`,
                      color: acc.color,
                    }}
                  >
                    {acc.yieldPercentage}% EA
                  </Badge>
                </div>

                {/* Balance info */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  <span>
                    Saldo actual: {formatCurrency(acc.balance)}
                    {amount > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {" "}
                        + {formatCurrency(amount)} ={" "}
                        {formatCurrency(acc.combinedBalance)}
                      </span>
                    )}
                  </span>
                </div>

                {/* Yield results */}
                <div className="space-y-1">
                  {amount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Rendimiento extra con tu aporte
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: acc.color }}
                      >
                        +{formatCurrency(acc.extraYield)}
                      </span>
                    </div>
                  )}
                  {amount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Rendimiento solo con tu monto
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(acc.standaloneYield)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Rendimiento actual ({daysRemaining}d restantes)
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(acc.currentYield)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No high-yield accounts message */}
      {accountResults.length === 0 && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6 text-center">
            <Wallet className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No tienes cuentas de alto rendimiento registradas
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Crea una cuenta con % EA para ver simulaciones
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hypothetical Accounts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Cuenta hipotética
          </h2>
        </div>

        {hypotheticalResults.map((hyp) => (
          <Card
            key={hyp.id}
            className="border-0 shadow-sm rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #6B728015, #6B728008)`,
              borderLeft: `4px solid #6B7280`,
            }}
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="size-3.5 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {hyp.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {hyp.ea}% EA
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-gray-400 hover:text-red-500"
                    onClick={() => handleRemoveHypothetical(hyp.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
              {amount > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Rendimiento a fin de mes ({daysRemaining}d)
                    </span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {formatCurrency(hyp.standaloneYield)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Rendimiento mes completo ({daysInMonth}d)
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {formatCurrency(hyp.fullMonthYield)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Ingresa un monto arriba para simular
                </p>
              )}
            </div>
          </Card>
        ))}

        {/* Add hypothetical form */}
        <Card className="border border-dashed border-gray-200 dark:border-gray-700 shadow-none rounded-2xl">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <Input
                  placeholder="Nombre cuenta"
                  value={newHypName}
                  onChange={(e) => setNewHypName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="col-span-1">
                <Input
                  placeholder="% EA"
                  type="number"
                  step="0.1"
                  value={newHypEA}
                  onChange={(e) => setNewHypEA(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="col-span-1">
                <Button
                  onClick={handleAddHypothetical}
                  className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  size="icon"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Option Recommendation */}
      {amount > 0 && (bestCombined || bestStandalone) && (
        <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Te conviene
              </h3>
            </div>
            <div className="space-y-2">
              {bestCombined && bestCombined.yield > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Con saldo conjunto
                    </span>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">
                      {bestCombined.name} ({bestCombined.ea}% EA) — saldo + tu
                      aporte
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    +{formatCurrency(bestCombined.yield)}
                  </span>
                </div>
              )}
              {bestStandalone && bestStandalone.yield > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Solo con tu monto
                    </span>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">
                      {bestStandalone.name} ({bestStandalone.ea}% EA)
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    +{formatCurrency(bestStandalone.yield)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info note */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Los cálculos usan interés compuesto proporcional a los días restantes
          del mes ({daysRemaining} de {daysInMonth}). Febrero con 28/29 días se
          calcula correctamente. El rendimiento real puede variar según las
          condiciones de cada entidad financiera.
        </p>
      </div>
    </motion.div>
  );
}
