"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, formatCurrency } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  TrendingUp,
  Check,
  Edit3,
  ChevronDown,
  ChevronUp,
  Undo2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface YieldItem {
  id: string | null;
  accountId: string | null;
  subAccountId: string | null;
  parentAccountId: string | null;
  accountName: string;
  balance: number;
  yieldPercentage: number;
  projectedYield: number;
  actualYield: number | null;
  isConfirmed: boolean;
  transactionId: string | null;
}

interface YieldHistoryItem {
  month: string;
  projected: number;
  actual: number | null;
}

interface YieldManagerProps {
  accounts: Array<{
    id: string;
    name: string;
    isHighYield: boolean;
    yieldPercentage?: number | null;
    balance: number;
  }>;
  yieldHistory?: YieldHistoryItem[];
}

const yieldChartConfig = {
  projected: { label: "Proyectado", color: "#f59e0b" },
  actual: { label: "Real", color: "#10b981" },
} satisfies ChartConfig;

/**
 * Check if we're within 2 days of the end of the month.
 * If so, we should show "Próximo Mes" yields.
 */
function isNearMonthEnd(): boolean {
  const now = new Date();
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return today >= lastDay - 1; // 2 days before end (inclusive of last day itself)
}

function getNextMonthLabel(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export function YieldManager({ accounts, yieldHistory }: YieldManagerProps) {
  const [yields, setYields] = useState<YieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);
  const [isConfirmedExpanded, setIsConfirmedExpanded] = useState(false);
  const [isNextMonthExpanded, setIsNextMonthExpanded] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [confirmReverseId, setConfirmReverseId] = useState<string | null>(null);

  const fetchYields = useCallback(async () => {
    try {
      const data = await apiFetch<YieldItem[]>("/api/yield");
      setYields(data);
    } catch (error) {
      console.error("Error fetching yields:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYields();
  }, [fetchYields]);

  const handleConfirm = async (item: YieldItem) => {
    const actualYield = editingId === (item.accountId || item.subAccountId)
      ? parseFloat(editValue) || item.projectedYield
      : item.actualYield || item.projectedYield;

    try {
      await apiFetch("/api/yield", {
        method: "POST",
        body: JSON.stringify({
          yieldRecordId: item.id,
          accountId: item.accountId,
          subAccountId: item.subAccountId,
          actualYield,
          yieldPercentage: item.yieldPercentage,
          projectedYield: item.projectedYield,
          parentAccountId: item.parentAccountId,
        }),
      });

      fetchYields();
      setEditingId(null);
    } catch (error) {
      console.error("Error confirming yield:", error);
    }
  };

  const handleReverse = async (item: YieldItem) => {
    if (!item.id) return;

    try {
      setReversingId(item.id);
      await apiFetch("/api/yield/reverse", {
        method: "POST",
        body: JSON.stringify({ yieldRecordId: item.id }),
      });

      fetchYields();
      setConfirmReverseId(null);
    } catch (error) {
      console.error("Error reversing yield:", error);
    } finally {
      setReversingId(null);
    }
  };

  if (loading || yields.length === 0) return null;

  const pendingYields = yields.filter((y) => !y.isConfirmed);
  const confirmedYields = yields.filter((y) => y.isConfirmed);
  const totalProjected = pendingYields.reduce((sum, y) => sum + y.projectedYield, 0);
  const totalConfirmed = confirmedYields.reduce((sum, y) => sum + (y.actualYield || 0), 0);
  const confirmedCount = confirmedYields.length;

  // Next month projected yields (based on current balances)
  const showNextMonth = isNearMonthEnd();
  const nextMonthYields = showNextMonth
    ? accounts.map((acc) => ({
        accountId: acc.id,
        accountName: acc.name,
        balance: acc.balance,
        yieldPercentage: acc.yieldPercentage || 0,
        projectedYield: acc.balance * ((acc.yieldPercentage || 0) / 100) / 12,
      }))
    : [];
  const totalNextMonthProjected = nextMonthYields.reduce((sum, y) => sum + y.projectedYield, 0);

  // Yield history chart data
  const chartData = (yieldHistory || [])
    .filter((h) => h.actual !== null)
    .map((h) => ({
      month: h.month,
      projected: Math.round(h.projected),
      actual: Math.round(h.actual || 0),
    }));

  return (
    <Card className="border-0 shadow-md rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 overflow-hidden">
      <CardContent className="p-0">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-emerald-100/50 dark:hover:bg-emerald-800/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <TrendingUp className="size-4 text-white" />
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Rendimientos del Mes
              </span>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {yields.length} cuenta{yields.length !== 1 ? "s" : ""} · {confirmedCount}/{yields.length} confirmado{confirmedCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(totalConfirmed || totalProjected)}
              </p>
              <p className="text-[10px] text-gray-400">
                {totalConfirmed > 0 ? "Total confirmado" : "Proyectado"}
              </p>
            </div>
            <div className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <div className="h-px bg-emerald-200 dark:bg-emerald-800/50" />

                {/* Pending Section */}
                {pendingYields.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsPendingExpanded(!isPendingExpanded)}
                      className="w-full flex items-center justify-between py-1.5 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        {isPendingExpanded ? (
                          <ChevronUp className="size-3.5 text-amber-500" />
                        ) : (
                          <ChevronDown className="size-3.5 text-amber-500" />
                        )}
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Pendientes
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 h-5 px-1.5"
                        >
                          {pendingYields.length}
                        </Badge>
                      </div>
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(totalProjected)}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isPendingExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden space-y-2"
                        >
                          {pendingYields.map((item) => {
                            const itemKey = item.accountId || item.subAccountId || "";
                            const isEditing = editingId === itemKey;

                            return (
                              <div
                                key={itemKey}
                                className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {item.accountName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700"
                                  >
                                    Pendiente
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                  <span>
                                    Balance: {formatCurrency(item.balance)} · {item.yieldPercentage}% anual
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <div className="flex-1">
                                        <CurrencyInput
                                          value={editValue}
                                          onChange={setEditValue}
                                          showPrefix
                                          placeholder={item.projectedYield.toString()}
                                          className="h-8 text-xs rounded-lg"
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        className="h-8 rounded-lg bg-emerald-500 text-xs"
                                        onClick={() => handleConfirm(item)}
                                      >
                                        <Check className="size-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(item.projectedYield)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] rounded-lg"
                                        onClick={() => {
                                          setEditingId(itemKey);
                                          setEditValue(item.projectedYield.toString());
                                        }}
                                      >
                                        <Edit3 className="size-3 mr-1" />
                                        Editar
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 text-[10px] rounded-lg bg-emerald-500"
                                        onClick={() => handleConfirm(item)}
                                      >
                                        Confirmar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Confirmed Section */}
                {confirmedYields.length > 0 && (
                  <div>
                    <button
                      onClick={() => setIsConfirmedExpanded(!isConfirmedExpanded)}
                      className="w-full flex items-center justify-between py-1.5 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        {isConfirmedExpanded ? (
                          <ChevronUp className="size-3.5 text-emerald-500" />
                        ) : (
                          <ChevronDown className="size-3.5 text-emerald-500" />
                        )}
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Confirmados
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 h-5 px-1.5"
                        >
                          {confirmedYields.length}
                        </Badge>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalConfirmed)}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isConfirmedExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden space-y-2"
                        >
                          {confirmedYields.map((item) => {
                            const itemKey = `confirmed-${item.accountId || item.subAccountId || ""}`;
                            const isReversing = reversingId === item.id;
                            const isConfirmingReverse = confirmReverseId === item.id;

                            return (
                              <div
                                key={itemKey}
                                className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {item.accountName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700"
                                  >
                                    Confirmado
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                  <span>{item.yieldPercentage}% anual</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Check className="size-4 text-emerald-500" />
                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(item.actualYield || 0)}
                                    </span>
                                  </div>

                                  {isConfirmingReverse ? (
                                    <div className="flex items-center gap-1.5">
                                      <AlertTriangle className="size-3.5 text-red-500" />
                                      <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">¿Revertir?</span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] rounded-lg border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 px-2"
                                        onClick={() => handleReverse(item)}
                                        disabled={isReversing}
                                      >
                                        {isReversing ? "..." : "Sí"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] rounded-lg px-2"
                                        onClick={() => setConfirmReverseId(null)}
                                        disabled={isReversing}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[10px] rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                                      onClick={() => setConfirmReverseId(item.id || null)}
                                    >
                                      <Undo2 className="size-3 mr-1" />
                                      Revertir
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Next Month Projected Section — shows 2 days before month end */}
                {showNextMonth && nextMonthYields.length > 0 && (
                  <div>
                    <div className="h-px bg-blue-200 dark:bg-blue-800/50" />
                    <button
                      onClick={() => setIsNextMonthExpanded(!isNextMonthExpanded)}
                      className="w-full flex items-center justify-between py-1.5 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        {isNextMonthExpanded ? (
                          <ChevronUp className="size-3.5 text-blue-500" />
                        ) : (
                          <ChevronDown className="size-3.5 text-blue-500" />
                        )}
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Próximo Mes
                        </span>
                        <CalendarClock className="size-3 text-blue-400" />
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 h-5 px-1.5"
                        >
                          {getNextMonthLabel()}
                        </Badge>
                      </div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(totalNextMonthProjected)}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isNextMonthExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden space-y-2"
                        >
                          {nextMonthYields.map((item) => (
                            <div
                              key={`next-${item.accountId}`}
                              className="p-3 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.accountName}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                                >
                                  Proyectado
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>
                                  Balance: {formatCurrency(item.balance)} · {item.yieldPercentage}% anual
                                </span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  {formatCurrency(item.projectedYield)}
                                </span>
                              </div>
                            </div>
                          ))}
                          <p className="text-[9px] text-blue-400 dark:text-blue-500 text-center">
                            Basado en el balance actual · Se actualizará al iniciar el nuevo mes
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Mini Yield History Chart */}
                {chartData.length >= 2 && (
                  <div>
                    <div className="h-px bg-emerald-200 dark:bg-emerald-800/50" />
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-2 mb-1">
                      Historial de rendimientos
                    </p>
                    <ChartContainer config={yieldChartConfig} className="h-[120px] w-full">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 8 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 8 }}
                          tickFormatter={(v: number) => {
                            if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                            if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                            return `${v}`;
                          }}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => (
                                <span className="font-mono font-medium">
                                  {formatCurrency(Number(value))}
                                </span>
                              )}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="projected" fill="var(--color-projected)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                        <Bar dataKey="actual" fill="var(--color-actual)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
