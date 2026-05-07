"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, Plus, ArrowUpRight,
  ArrowDownRight, Fuel, Heart, ShoppingBasket, Receipt, Clock,
  LayoutGrid, GripVertical, Settings2, ChevronRight, Check, ArrowUpDown, PiggyBank,
} from "lucide-react";
import { useAppStore, type ModuleType } from "@/lib/store";
import { formatCurrency, apiFetch, calcPercentage } from "@/lib/api";
import { NetWorthCard } from "@/components/finance/net-worth-card";
import { FinanceMiniChart } from "@/components/finance/finance-mini-chart";
import { SmartAlerts } from "@/components/finance/smart-alerts";
import { motion } from "framer-motion";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragStartEvent, DragOverlay, TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============================================
// INTERFACES
// ============================================

interface SubAccount {
  id: string; name: string; balance: number;
  isHighYield?: boolean; yieldPercentage?: number | null;
  color?: string | null; excludeFromAvailable?: boolean;
}

interface Account {
  id: string; name: string; type: string; color: string; icon?: string | null;
  balance: number; isHighYield: boolean; yieldPercentage?: number | null;
  isShared: boolean; excludeFromAvailable?: boolean;
  subAccounts: SubAccount[];
  sharedUsers?: Array<{ id: string; user: { name: string; email: string } }>;
}

interface Transaction {
  id: string; type: string; amount: number; description: string;
  category?: string | null; date: string;
  account?: { id: string; name: string; color: string } | null;
}

interface Budget { id: string; type: string; category: string; amount: number; spent: number; }

interface Debt {
  id: string; name: string; type: string; currentBalance: number;
  originalAmount?: number; monthlyPayment?: number | null;
  paymentDate?: number | null; color: string;
}

// ============================================
// HOME WIDGET CONFIGURATION
// ============================================

type HomeWidgetId =
  | "balance" | "quickActions" | "alerts" | "netWorth" | "miniChart"
  | "debtSummary" | "yieldProjection" | "recentTransactions" | "moduleShortcuts";

type WidgetModule = "finance" | "cross";

interface HomeWidgetConfig {
  id: HomeWidgetId; label: string; icon: typeof Wallet;
  visible: boolean; order: number; module: WidgetModule;
}

const DEFAULT_HOME_WIDGETS: HomeWidgetConfig[] = [
  { id: "balance", label: "Balance Total", icon: Wallet, visible: true, order: 0, module: "finance" },
  { id: "netWorth", label: "Patrimonio Neto", icon: Wallet, visible: true, order: 1, module: "finance" },
  { id: "alerts", label: "Alertas Inteligentes", icon: Clock, visible: true, order: 2, module: "finance" },
  { id: "quickActions", label: "Acciones Rápidas", icon: Plus, visible: true, order: 3, module: "finance" },
  { id: "debtSummary", label: "Resumen Deudas", icon: CreditCard, visible: false, order: 4, module: "finance" },
  { id: "miniChart", label: "Tendencia Financiera", icon: TrendingUp, visible: false, order: 5, module: "finance" },
  { id: "yieldProjection", label: "Proyección Rendimientos", icon: TrendingUp, visible: false, order: 6, module: "finance" },
  { id: "recentTransactions", label: "Transacciones Recientes", icon: Receipt, visible: false, order: 7, module: "finance" },
  { id: "moduleShortcuts", label: "Módulos", icon: LayoutGrid, visible: true, order: 8, module: "cross" },
];

const STORAGE_KEY = "qapital-home-widgets";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

function loadHomeWidgetConfig(): HomeWidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_HOME_WIDGETS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as HomeWidgetConfig[];
      const savedIds = new Set(parsed.map((w) => w.id));
      const merged = [...parsed];
      for (const def of DEFAULT_HOME_WIDGETS) {
        if (!savedIds.has(def.id)) merged.push({ ...def, order: merged.length });
      }
      return merged.sort((a, b) => a.order - b.order);
    }
  } catch { /* ignore */ }
  return DEFAULT_HOME_WIDGETS;
}

function saveHomeWidgetConfig(widgets: HomeWidgetConfig[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); } catch { /* ignore */ }
}

// ============================================
// COMPUTED HELPERS
// ============================================

function getAvailableBalance(accounts: Account[]) {
  return accounts.reduce((sum, a) => {
    const acc = a.excludeFromAvailable ? 0 : a.balance;
    const sub = a.subAccounts.reduce((s, sa) => (sa.excludeFromAvailable ? s : s + sa.balance), 0);
    return sum + acc + sub;
  }, 0);
}

function getGrandTotal(accounts: Account[]) {
  return accounts.reduce((s, a) => s + a.balance, 0) +
    accounts.reduce((s, a) => s + a.subAccounts.reduce((ss, sa) => ss + sa.balance, 0), 0);
}

function getMonthlyYield(accounts: Account[]) {
  const items: Array<{ name: string; yield: number }> = [];
  for (const a of accounts) {
    if (a.isHighYield && a.yieldPercentage)
      items.push({ name: a.name, yield: (a.balance * a.yieldPercentage) / 1200 });
    for (const sa of a.subAccounts)
      if (sa.isHighYield && sa.yieldPercentage)
        items.push({ name: sa.name, yield: (sa.balance * sa.yieldPercentage) / 1200 });
  }
  return items;
}

// ============================================
// SORTABLE WRAPPER COMPONENTS
// ============================================

function SortableWidgetItem({ id, children }: { id: HomeWidgetId; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : "auto", position: "relative" as const,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        <div {...attributes} {...listeners}
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-none">
          <div className="size-7 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 flex items-center justify-center active:bg-emerald-50 dark:active:bg-emerald-900/20 transition-colors">
            <GripVertical className="size-3.5 text-gray-400" />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SortableSheetItem({ widget, index, onToggle }: {
  widget: HomeWidgetConfig; index: number; onToggle: (id: HomeWidgetId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const WidgetIcon = widget.icon;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isDragging ? "bg-emerald-50 dark:bg-emerald-900/20 shadow-lg border-2 border-emerald-300 dark:border-emerald-600"
          : widget.visible ? "bg-gray-50 dark:bg-gray-800/50" : "bg-gray-50/50 dark:bg-gray-800/20 opacity-60"}`}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
          <div className="size-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:bg-emerald-50 dark:active:bg-emerald-900/20 transition-colors">
            <GripVertical className="size-4 text-gray-400" />
          </div>
        </div>
        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${widget.visible ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
          <WidgetIcon className={`size-4 ${widget.visible ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`} />
        </div>
        <span className={`flex-1 text-sm font-medium ${widget.visible ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
          {widget.label}
        </span>
        <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full shrink-0">
          {widget.module === "finance" ? "Finanzas" : "Módulos"}
        </span>
        <span className="text-[10px] text-gray-400 font-mono shrink-0">#{index + 1}</span>
        <Switch checked={widget.visible} onCheckedChange={() => onToggle(widget.id)} />
      </div>
    </div>
  );
}

// ============================================
// WIDGET CONTENT COMPONENTS
// ============================================

function BalanceWidget({ accounts, onNavigate }: { accounts: Account[]; onNavigate: () => void }) {
  const available = getAvailableBalance(accounts);
  const grand = getGrandTotal(accounts);
  const excluded = grand - available;
  return (
    <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white overflow-hidden relative cursor-pointer" onClick={onNavigate}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
      <CardContent className="p-5 relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="size-4 text-emerald-200" />
          <span className="text-sm text-emerald-100">Disponible para Gastar</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{formatCurrency(available)}</p>
        {excluded > 0 && <p className="text-[10px] text-emerald-200/70 mt-1">{formatCurrency(excluded)} exento(s) de disponible</p>}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
          <Wallet className="size-3 text-emerald-300/60" />
          <span className="text-[10px] text-emerald-200/60">Balance Total</span>
          <span className="text-xs font-medium text-emerald-100/70 ml-auto">{formatCurrency(grand)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsWidget({ onIncome, onExpense, onBudget }: {
  onIncome: () => void; onExpense: () => void; onBudget: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1 h-12 rounded-xl border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10" onClick={onIncome}>
        <TrendingUp className="size-4 mr-1" />Ingreso
      </Button>
      <Button variant="outline" className="flex-1 h-12 rounded-xl border-dashed border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10" onClick={onExpense}>
        <TrendingDown className="size-4 mr-1" />Gasto
      </Button>
      <Button variant="outline" className="flex-1 h-12 rounded-xl border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10" onClick={onBudget}>
        <Receipt className="size-4 mr-1" />Presupuesto
      </Button>
    </div>
  );
}

function DebtSummaryWidget({ debts, onNavigate }: { debts: Debt[]; onNavigate: () => void }) {
  const active = debts.filter((d) => d.currentBalance > 0);
  const totalDebt = active.reduce((s, d) => s + d.currentBalance, 0);
  const totalOriginal = active.reduce((s, d) => s + (d.originalAmount || d.currentBalance), 0);
  const paid = totalOriginal > 0 ? calcPercentage(totalOriginal - totalDebt, totalOriginal) : 0;
  const now = new Date().getDate();
  const next = active.filter((d) => d.paymentDate).sort((a, b) => (a.paymentDate || 0) - (b.paymentDate || 0)).find((d) => (d.paymentDate || 0) >= now) || active[0];

  if (active.length === 0) return null;
  return (
    <Card className="border-0 shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow" onClick={onNavigate}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center">
              <CreditCard className="size-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Resumen Deudas</p>
              <p className="text-[9px] text-gray-400">{active.length} deuda{active.length !== 1 ? "s" : ""} activa{active.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400">Pagado</span>
            <span className="text-[9px] font-medium text-emerald-600">{paid}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all" style={{ width: `${Math.min(paid, 100)}%` }} />
          </div>
        </div>
        {next && (
          <div className="flex items-center gap-2 p-2 bg-rose-50/60 dark:bg-rose-900/10 rounded-lg">
            <Clock className="size-3 text-rose-400" />
            <span className="text-[10px] text-gray-600 dark:text-gray-300 flex-1">Próximo: {next.name}</span>
            <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">{next.paymentDate ? `Día ${next.paymentDate}` : "Próximo"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YieldProjectionWidget({ accounts, onNavigate }: { accounts: Account[]; onNavigate: () => void }) {
  const items = getMonthlyYield(accounts);
  const total = items.reduce((s, y) => s + y.yield, 0);
  if (items.length === 0) return null;
  return (
    <Card className="border-0 shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow" onClick={onNavigate}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-400 flex items-center justify-center">
              <TrendingUp className="size-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Proyección Rendimientos</p>
              <p className="text-[9px] text-gray-400">Este mes</p>
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(total)}</p>
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 3).map((it) => (
            <div key={it.name} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex-1">{it.name}</span>
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 ml-2">+{formatCurrency(it.yield)}</span>
            </div>
          ))}
          {items.length > 3 && <p className="text-[9px] text-gray-400 text-center">+{items.length - 3} cuenta{items.length - 3 !== 1 ? "s" : ""} más</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentTransactionsWidget({ transactions, onNavigate }: { transactions: Transaction[]; onNavigate: () => void }) {
  const recent = transactions.slice(0, 3);
  return (
    <Card className="border-0 shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow" onClick={onNavigate}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Receipt className="size-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">Transacciones Recientes</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
            Ver todo <ChevronRight className="size-3" />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Sin transacciones aún</p>
        ) : (
          <div className="space-y-2.5">
            {recent.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`size-8 rounded-xl flex items-center justify-center ${tx.type === "income" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600"}`}>
                    {tx.type === "income" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{tx.description}</p>
                    <p className="text-[9px] text-gray-400">{tx.category || "Sin categoría"}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-gray-900 dark:text-white"}`}>
                  {tx.type === "income" ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModuleShortcutsWidget({ onNavigate }: { onNavigate: (m: ModuleType) => void }) {
  const mods = [
    { module: "transport" as ModuleType, icon: Fuel, label: "Transporte", sub: "Combustible y más", gradient: "from-sky-400 to-cyan-400" },
    { module: "health" as ModuleType, icon: Heart, label: "Salud", sub: "Medicamentos y citas", gradient: "from-rose-400 to-pink-400" },
    { module: "pantry" as ModuleType, icon: ShoppingBasket, label: "Despensa", sub: "Inventario y listas", gradient: "from-amber-400 to-orange-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {mods.map((m) => (
        <Card key={m.module} className="border-0 shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate(m.module)}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex items-center justify-center size-10 rounded-xl bg-gradient-to-br ${m.gradient} mb-2`}>
              <m.icon className="size-5 text-white" />
            </div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">{m.label}</p>
            <p className="text-[9px] text-gray-400">{m.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DashboardPage() {
  const { setActiveModule, setFinanceSubView } = useAppStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [widgetConfig, setWidgetConfig] = useState<HomeWidgetConfig[]>(DEFAULT_HOME_WIDGETS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<HomeWidgetConfig[]>([]);
  const [activeWidgetId, setActiveWidgetId] = useState<HomeWidgetId | null>(null);

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

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setWidgetConfig(loadHomeWidgetConfig()); }, []);

  // Computed
  const monthlyIncome = budgets.filter((b) => b.type === "income").reduce((s, b) => s + b.spent, 0);
  const monthlyExpenses = budgets.filter((b) => b.type === "expense").reduce((s, b) => s + b.spent, 0);

  // Navigation
  const goAccounts = () => { setActiveModule("finance"); setFinanceSubView("accounts"); };
  const goDebts = () => { setActiveModule("finance"); setFinanceSubView("debts"); };
  const goBudgets = () => { setActiveModule("finance"); setFinanceSubView("budgets"); };

  // Customization
  const openCustomize = () => { setTempConfig(widgetConfig.map((w) => ({ ...w }))); setCustomizeOpen(true); };
  const handleToggleWidget = (id: HomeWidgetId) => setTempConfig((p) => p.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  const saveCustomization = () => {
    const nc = tempConfig.map((w, i) => ({ ...w, order: i }));
    setWidgetConfig(nc); saveHomeWidgetConfig(nc); setCustomizeOpen(false);
  };
  const resetCustomization = () => setTempConfig(DEFAULT_HOME_WIDGETS.map((w) => ({ ...w })));

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (e: DragStartEvent) => setActiveWidgetId(e.active.id as HomeWidgetId);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveWidgetId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const vis = widgetConfig.sort((a, b) => a.order - b.order).filter((w) => w.visible);
    const oi = vis.findIndex((w) => w.id === active.id);
    const ni = vis.findIndex((w) => w.id === over.id);
    if (oi === -1 || ni === -1) return;
    const reord = arrayMove(vis, oi, ni).map((w, i) => ({ ...w, order: i }));
    const hidden = widgetConfig.filter((w) => !w.visible);
    const merged = [...reord, ...hidden.map((w, i) => ({ ...w, order: reord.length + i }))];
    setWidgetConfig(merged); saveHomeWidgetConfig(merged);
  };

  const handleSheetDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const sorted = [...tempConfig].sort((a, b) => a.order - b.order);
    const oi = sorted.findIndex((w) => w.id === active.id);
    const ni = sorted.findIndex((w) => w.id === over.id);
    if (oi === -1 || ni === -1) return;
    setTempConfig(arrayMove(sorted, oi, ni).map((w, i) => ({ ...w, order: i })));
  };

  // Widget render
  const renderWidget = (id: HomeWidgetId) => {
    switch (id) {
      case "balance": return <BalanceWidget accounts={accounts} onNavigate={goAccounts} />;
      case "quickActions": return <QuickActionsWidget onIncome={goAccounts} onExpense={goAccounts} onBudget={goBudgets} />;
      case "alerts": return <SmartAlerts />;
      case "netWorth": return (
        <div className="cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.99]" onClick={goAccounts}>
          <NetWorthCard />
        </div>
      );
      case "miniChart": return <FinanceMiniChart />;
      case "debtSummary": return <DebtSummaryWidget debts={debts} onNavigate={goDebts} />;
      case "yieldProjection": return <YieldProjectionWidget accounts={accounts} onNavigate={goAccounts} />;
      case "recentTransactions": return <RecentTransactionsWidget transactions={transactions} onNavigate={goAccounts} />;
      case "moduleShortcuts": return <ModuleShortcutsWidget onNavigate={setActiveModule} />;
      default: return null;
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <div><div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" /><div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mt-1" /></div>
        </div>
        <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" /><div className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" /></div>
        <div className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  const visibleWidgets = widgetConfig.sort((a, b) => a.order - b.order).filter((w) => w.visible);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-4 space-y-4 pb-24">
      {/* Greeting + Settings */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">¡Hola! 👋</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Aquí está tu resumen de hoy</p>
        </div>
        <button onClick={openCustomize} className="size-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" aria-label="Personalizar dashboard">
          <Settings2 className="size-4 text-gray-400" />
        </button>
      </motion.div>

      {/* Quick Income/Expense Summary */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <div className="size-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><ArrowUpRight className="size-3 text-emerald-600 dark:text-emerald-400" /></div>
            <div><p className="text-[9px] text-gray-400">Ingresos</p><p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(monthlyIncome)}</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"><ArrowDownRight className="size-3 text-rose-600 dark:text-rose-400" /></div>
            <div><p className="text-[9px] text-gray-400">Gastos</p><p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(monthlyExpenses)}</p></div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="size-6 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center"><PiggyBank className="size-3 text-teal-600 dark:text-teal-400" /></div>
            <div><p className="text-[9px] text-gray-400">Ahorro</p><p className="text-xs font-semibold text-teal-600 dark:text-teal-400">{formatCurrency(Math.max(monthlyIncome - monthlyExpenses, 0))}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Widget Grid — Draggable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          {visibleWidgets.map((w) => (
            <SortableWidgetItem key={w.id} id={w.id}>
              <motion.div variants={itemVariants}>{renderWidget(w.id)}</motion.div>
            </SortableWidgetItem>
          ))}
        </SortableContext>
        <DragOverlay>
          {activeWidgetId ? <div className="opacity-80 shadow-2xl rounded-2xl">{renderWidget(activeWidgetId)}</div> : null}
        </DragOverlay>
      </DndContext>

      {/* Drag hint */}
      <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-1">
        <GripVertical className="size-3" />Arrastra el ícono para reordenar secciones
      </p>

      {/* Customization Sheet */}
      <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh]">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <ArrowUpDown className="size-4 text-emerald-600" />Personalizar Inicio
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-2 mb-6 max-h-[55vh] overflow-y-auto">
            <p className="text-xs text-gray-400 mb-3">Arrastra el ícono de agarre para reordenar. Activa o desactiva las secciones que quieras ver.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSheetDragEnd}>
              <SortableContext items={tempConfig.sort((a, b) => a.order - b.order).map((w) => w.id)} strategy={verticalListSortingStrategy}>
                {tempConfig.sort((a, b) => a.order - b.order).map((w, i) => (
                  <SortableSheetItem key={w.id} widget={w} index={i} onToggle={handleToggleWidget} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="flex gap-2 sticky bottom-0 bg-white dark:bg-gray-950 pt-3 border-t dark:border-gray-800">
            <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={resetCustomization}>Restaurar</Button>
            <Button className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white" onClick={saveCustomization}>
              <Check className="size-4 mr-1" />Guardar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}