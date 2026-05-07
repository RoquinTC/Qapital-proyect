"use client";

import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { AccountForm } from "./account-form";
import { TransactionForm } from "./transaction-form";
import { YieldManager } from "./yield-manager";
import { FinanceMiniChart } from "./finance-mini-chart";
import { NetWorthCard } from "./net-worth-card";
import { SmartAlerts } from "./smart-alerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  Smartphone,
  CircleDollarSign,
  CreditCard,
  Receipt,
  PiggyBank,
  Clock,
  Landmark,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Check,
  GripVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============================================
// INTERFACES
// ============================================

interface SubAccount {
  id: string;
  name: string;
  balance: number;
  isHighYield: boolean;
  yieldPercentage?: number | null;
  color?: string | null;
  excludeFromAvailable?: boolean;
}

interface Account {
  id: string;
  name: string;
  type: string;
  color: string;
  icon?: string | null;
  balance: number;
  isHighYield: boolean;
  yieldPercentage?: number | null;
  isShared: boolean;
  excludeFromAvailable?: boolean;
  subAccounts: SubAccount[];
  sharedUsers: Array<{
    id: string;
    user: { name: string; email: string };
  }>;
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
  currentBalance: number;
  color: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  icon?: string | null;
  color: string;
}

interface RecurringPayment {
  id: string;
  description: string;
  amount: number;
  status: string;
  scheduledDate: string;
}

// Widget configuration types
export type WidgetId = "balance" | "quickActions" | "alerts" | "overview" | "netWorth" | "miniChart" | "accounts" | "yields";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  icon: typeof Wallet;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGET_ORDER: WidgetConfig[] = [
  { id: "balance", label: "Balance Total", icon: Wallet, visible: true, order: 0 },
  { id: "quickActions", label: "Acciones Rápidas", icon: Plus, visible: true, order: 1 },
  { id: "alerts", label: "Alertas Inteligentes", icon: Clock, visible: true, order: 2 },
  { id: "netWorth", label: "Patrimonio Neto", icon: Wallet, visible: true, order: 3 },
  { id: "overview", label: "Resumen Financiero", icon: Receipt, visible: true, order: 4 },
  { id: "miniChart", label: "Tendencia Financiera", icon: TrendingUp, visible: true, order: 5 },
  { id: "accounts", label: "Mis Cuentas", icon: Landmark, visible: true, order: 6 },
  { id: "yields", label: "Rendimientos", icon: TrendingUp, visible: true, order: 7 },
];

const typeIcons: Record<string, typeof Wallet> = {
  checking: Banknote,
  savings: Wallet,
  cash: CircleDollarSign,
  digital_wallet: Smartphone,
  credit_card: CreditCard,
  other: Wallet,
};

const typeLabels: Record<string, string> = {
  checking: "Cuenta Corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  digital_wallet: "Billetera Digital",
  credit_card: "Tarjeta de Crédito",
  other: "Otra",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

function loadWidgetConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGET_ORDER;
  try {
    const saved = localStorage.getItem("qapital-dashboard-widgets");
    if (saved) {
      const parsed = JSON.parse(saved) as WidgetConfig[];
      const savedIds = new Set(parsed.map((w) => w.id));
      const merged = [...parsed];
      for (const def of DEFAULT_WIDGET_ORDER) {
        if (!savedIds.has(def.id)) {
          merged.push({ ...def, order: merged.length });
        }
      }
      return merged.sort((a, b) => a.order - b.order);
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDGET_ORDER;
}

function saveWidgetConfig(widgets: WidgetConfig[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("qapital-dashboard-widgets", JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

function loadAccountOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("qapital-account-order");
    if (saved) return JSON.parse(saved) as string[];
  } catch {
    // ignore
  }
  return [];
}

function saveAccountOrder(order: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("qapital-account-order", JSON.stringify(order));
  } catch {
    // ignore
  }
}

function sortAccountsByOrder(accounts: Account[], order: string[]): Account[] {
  if (!order.length) return accounts;
  const ordered = order
    .map((id) => accounts.find((a) => a.id === id))
    .filter(Boolean) as Account[];
  const remaining = accounts.filter((a) => !order.includes(a.id));
  return [...ordered, ...remaining];
}

// ============================================
// SORTABLE WRAPPER COMPONENTS
// ============================================

/**
 * SortableWidgetItem — wraps each dashboard section.
 * Uses a dedicated GRIP HANDLE for drag activation.
 * This ensures page scrolling works on mobile (no delay-based sensors).
 */
function SortableWidgetItem({ id, children }: { id: WidgetId; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        {/* Drag handle — ALWAYS visible on touch, hover-visible on desktop */}
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing
            opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity
            touch-none"
        >
          <div className="size-7 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 flex items-center justify-center active:bg-emerald-50 dark:active:bg-emerald-900/20 transition-colors">
            <GripVertical className="size-3.5 text-gray-400" />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * SortableAccountCard — each account card in the carousel.
 * KEY DESIGN: The drag handle is a separate button OVERLAID on the card.
 * - Touching the card itself = scroll the carousel + tap to navigate
 * - Touching the grip handle = drag to reorder
 * This prevents the drag system from blocking carousel scroll on mobile.
 */
function SortableAccountCard({
  account,
  onNavigate,
}: {
  account: Account;
  onNavigate: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const Icon = typeIcons[account.type] || Wallet;
  const typeLabel = typeLabels[account.type] || "Cuenta";
  const isNegative = account.balance < 0;
  const hasSubAccounts = account.subAccounts.length > 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="shrink-0 snap-start">
      {/* Clickable card area — navigates on tap, scrolls with touch */}
      <button
        onClick={() => onNavigate(account.id)}
        className="block text-left"
      >
        <div
          className="w-[140px] rounded-2xl p-3 shadow-md relative overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${account.color}, ${account.color}cc)`,
            ...(isDragging ? { boxShadow: "0 12px 28px rgba(0,0,0,0.25)" } : {}),
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />

          {/* DRAG HANDLE — overlaid on card, stops propagation so it doesn't trigger navigation */}
          <div
            {...attributes}
            {...listeners}
            className="absolute top-1 right-1 z-30 cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="size-5 rounded-md bg-white/25 backdrop-blur-sm flex items-center justify-center
              opacity-70 active:opacity-100 transition-opacity
              shadow-sm border border-white/20">
              <GripVertical className="size-3 text-white" />
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="size-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Icon className="size-3 text-white" />
              </div>
              <p className="text-[11px] font-medium text-white/90 truncate leading-tight">
                {account.name}
              </p>
            </div>
            <p className="text-[9px] text-white/50 mb-1.5 leading-tight">
              {typeLabel}
            </p>
            <p className="text-[15px] font-bold text-white tracking-tight leading-tight">
              {isNegative ? "-" : ""}{formatCurrency(Math.abs(account.balance))}
            </p>
            {hasSubAccounts && (
              <div className="flex items-center gap-1 mt-1">
                <div className="flex -space-x-0.5">
                  {account.subAccounts.slice(0, 3).map((sub, i) => (
                    <div
                      key={sub.id}
                      className="size-2.5 rounded-full border border-white/30"
                      style={{ backgroundColor: sub.color || "#fff", zIndex: 3 - i }}
                    />
                  ))}
                </div>
                <span className="text-[8px] text-white/50">
                  {account.subAccounts.length} bolsillo{account.subAccounts.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1.5">
              <div className={`size-1.5 rounded-full ${isNegative ? "bg-rose-300" : "bg-emerald-300"}`} />
              <span className="text-[8px] text-white/40">
                {isNegative ? "Negativo" : "Positivo"}
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function SortableSheetItem({
  widget,
  index,
  onToggle,
}: {
  widget: WidgetConfig;
  index: number;
  onToggle: (id: WidgetId) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const WidgetIcon = widget.icon;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
          isDragging
            ? "bg-emerald-50 dark:bg-emerald-900/20 shadow-lg border-2 border-emerald-300 dark:border-emerald-600"
            : widget.visible
              ? "bg-gray-50 dark:bg-gray-800/50"
              : "bg-gray-50/50 dark:bg-gray-800/20 opacity-60"
        }`}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
        >
          <div className="size-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:bg-emerald-50 dark:active:bg-emerald-900/20 transition-colors">
            <GripVertical className="size-4 text-gray-400" />
          </div>
        </div>

        {/* Widget icon */}
        <div
          className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
            widget.visible
              ? "bg-emerald-100 dark:bg-emerald-900/30"
              : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          <WidgetIcon
            className={`size-4 ${
              widget.visible
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400"
            }`}
          />
        </div>

        {/* Widget label */}
        <span
          className={`flex-1 text-sm font-medium ${
            widget.visible
              ? "text-gray-900 dark:text-white"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {widget.label}
        </span>

        {/* Position badge */}
        <span className="text-[10px] text-gray-400 font-mono shrink-0">
          #{index + 1}
        </span>

        {/* Visibility toggle */}
        <Switch
          checked={widget.visible}
          onCheckedChange={() => onToggle(widget.id)}
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AccountsView() {
  const { setFinanceSubView } = useAppStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringPending, setRecurringPending] = useState<RecurringPayment[]>([]);
  const [yieldHistory, setYieldHistory] = useState<Array<{ month: string; projected: number; actual: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig[]>(DEFAULT_WIDGET_ORDER);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<WidgetConfig[]>([]);
  const [accountOrder, setAccountOrder] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag overlay state
  const [activeWidgetId, setActiveWidgetId] = useState<WidgetId | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [accs, budgs, dbts, savs, recs, hist] = await Promise.allSettled([
        apiFetch<Account[]>("/api/accounts"),
        apiFetch<Budget[]>("/api/budgets"),
        apiFetch<Debt[]>("/api/debts"),
        apiFetch<SavingsGoal[]>("/api/savings"),
        apiFetch<RecurringPayment[]>("/api/recurring"),
        apiFetch<{ yieldHistory: Array<{ month: string; projected: number; actual: number | null }> }>("/api/finance/history"),
      ]);

      if (accs.status === "fulfilled") setAccounts(accs.value);
      if (budgs.status === "fulfilled") setBudgets(budgs.value);
      if (dbts.status === "fulfilled") setDebts(dbts.value);
      if (savs.status === "fulfilled") setSavingsGoals(savs.value);
      if (recs.status === "fulfilled")
        setRecurringPending(recs.value.filter((r) => r.status === "pending"));
      if (hist.status === "fulfilled") setYieldHistory(hist.value.yieldHistory || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setWidgetConfig(loadWidgetConfig());
    setAccountOrder(loadAccountOrder());
  }, []);

  // Total Balance: sum of all account balances (direct, not including sub-accounts)
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  // Total Sub-Account Balance: sum of all sub-account balances (independent from account balance)
  const totalSubAccountBalance = accounts.reduce(
    (sum, a) => sum + a.subAccounts.reduce((s, sa) => s + sa.balance, 0),
    0
  );
  // Grand Total: all money across accounts + sub-accounts (they are independent pools)
  const grandTotal = totalBalance + totalSubAccountBalance;

  // Available to Spend: only money that is NOT excluded
  // account.balance and subAccount.balance are SEPARATE — a transaction on a sub-account
  // only updates subAccount.balance, never account.balance. So we must sum them independently.
  const availableBalance = accounts.reduce((sum, a) => {
    // Account's own balance: included unless the whole account is excluded
    const accountPortion = a.excludeFromAvailable ? 0 : a.balance;
    // Sub-account balances: each one is individually checked for exclusion
    const subAccountPortion = a.subAccounts.reduce(
      (s, sa) => (sa.excludeFromAvailable ? s : s + sa.balance),
      0
    );
    return sum + accountPortion + subAccountPortion;
  }, 0);

  const excludedBalance = grandTotal - availableBalance;

  const highYieldAccounts = accounts.filter((a) => a.isHighYield);

  const totalBudget = budgets
    .filter((b) => b.type === "expense")
    .reduce((sum, b) => sum + b.amount, 0);
  const totalBudgetSpent = budgets
    .filter((b) => b.type === "expense")
    .reduce((sum, b) => sum + b.spent, 0);
  const budgetPercentage =
    totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0;

  const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalSavings = savingsGoals.reduce(
    (sum, s) => sum + s.currentAmount,
    0
  );
  const totalSavingsTarget = savingsGoals.reduce(
    (sum, s) => sum + s.targetAmount,
    0
  );
  const savingsPercentage =
    totalSavingsTarget > 0
      ? Math.round((totalSavings / totalSavingsTarget) * 100)
      : 0;

  const totalRecurringPending = recurringPending.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const handleAccountClick = (accountId: string) => {
    sessionStorage.setItem("selectedAccountId", accountId);
    setFinanceSubView("account-detail");
  };

  const scrollCarousel = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 160;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const sortedAccounts = sortAccountsByOrder(accounts, accountOrder);

  const persistAccountOrder = async (newOrder: string[]) => {
    saveAccountOrder(newOrder);
    for (let i = 0; i < newOrder.length; i++) {
      try {
        await apiFetch(`/api/accounts/${newOrder[i]}`, {
          method: "PUT",
          body: JSON.stringify({ order: i }),
        });
      } catch {
        // Silently fail - localStorage is the source of truth
      }
    }
  };

  // ============================================
  // WIDGET CUSTOMIZATION
  // ============================================

  const openCustomize = () => {
    setTempConfig(widgetConfig.map((w) => ({ ...w })));
    setCustomizeOpen(true);
  };

  const handleToggleWidget = (id: WidgetId) => {
    setTempConfig((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const saveCustomization = () => {
    const newConfig = tempConfig.map((w, i) => ({ ...w, order: i }));
    setWidgetConfig(newConfig);
    saveWidgetConfig(newConfig);
    setCustomizeOpen(false);
  };

  const resetCustomization = () => {
    setTempConfig(DEFAULT_WIDGET_ORDER.map((w) => ({ ...w })));
  };

  // ============================================
  // DND SENSORS — ALL use distance constraint (no delay!)
  // This ensures touch scrolling is NEVER blocked.
  // Drag only activates from grip handles.
  // ============================================

  const handleSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // ============================================
  // WIDGET DRAG HANDLERS
  // ============================================

  const handleWidgetDragStart = (event: DragStartEvent) => {
    setActiveWidgetId(event.active.id as WidgetId);
  };

  const handleWidgetDragEnd = (event: DragEndEvent) => {
    setActiveWidgetId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visibleWidgets = widgetConfig
      .sort((a, b) => a.order - b.order)
      .filter((w) => w.visible);
    const oldIndex = visibleWidgets.findIndex((w) => w.id === active.id);
    const newIndex = visibleWidgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(visibleWidgets, oldIndex, newIndex);
    const newConfig = reordered.map((w, i) => ({ ...w, order: i }));
    const hiddenWidgets = widgetConfig.filter((w) => !w.visible);
    const merged = [
      ...newConfig,
      ...hiddenWidgets.map((w, i) => ({ ...w, order: newConfig.length + i })),
    ];
    setWidgetConfig(merged);
    saveWidgetConfig(merged);
  };

  // ============================================
  // ACCOUNT DRAG HANDLERS
  // ============================================

  const handleAccountDragStart = (event: DragStartEvent) => {
    setActiveAccountId(event.active.id as string);
  };

  const handleAccountDragEnd = (event: DragEndEvent) => {
    setActiveAccountId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedAccounts.findIndex((a) => a.id === active.id);
    const newIndex = sortedAccounts.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedAccounts, oldIndex, newIndex);
    const newOrder = reordered.map((a) => a.id);
    setAccountOrder(newOrder);
    setAccounts(reordered);
    persistAccountOrder(newOrder);
  };

  // ============================================
  // SHEET DRAG HANDLERS
  // ============================================

  const handleSheetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = [...tempConfig].sort((a, b) => a.order - b.order);
    const oldIndex = sorted.findIndex((w) => w.id === active.id);
    const newIndex = sorted.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setTempConfig(reordered.map((w, i) => ({ ...w, order: i })));
  };

  // ============================================
  // WIDGET RENDER FUNCTIONS
  // ============================================

  const renderWidgetContent = (id: WidgetId) => {
    switch (id) {
      case "balance":
        return (
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="size-4 text-emerald-200" />
                <span className="text-sm text-emerald-100">
                  Disponible para Gastar
                </span>
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(availableBalance)}
              </p>
              {excludedBalance > 0 && (
                <p className="text-[10px] text-emerald-200/70 mt-1">
                  {formatCurrency(excludedBalance)} exento(s) de disponible
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <Wallet className="size-3 text-emerald-300/60" />
                <span className="text-[10px] text-emerald-200/60">
                  Balance Total
                </span>
                <span className="text-xs font-medium text-emerald-100/70 ml-auto">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        );

      case "quickActions":
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
              onClick={() => setShowTransactionForm(true)}
            >
              <TrendingUp className="size-4 mr-1" />
              Ingreso
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl border-dashed border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10"
              onClick={() => setShowTransactionForm(true)}
            >
              <TrendingDown className="size-4 mr-1" />
              Gasto
            </Button>
          </div>
        );

      case "overview":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Card
              className="border-0 shadow-sm rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFinanceSubView("budgets")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="size-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Receipt className="size-3 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    Presupuesto
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalBudgetSpent)}{" "}
                  <span className="text-[9px] font-normal text-gray-400">
                    / {formatCurrency(totalBudget)}
                  </span>
                </p>
                <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetPercentage > 90
                        ? "bg-red-500"
                        : budgetPercentage > 70
                          ? "bg-amber-500"
                          : "bg-violet-500"
                    }`}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {budgetPercentage}% usado
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-0 shadow-sm rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFinanceSubView("debts")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="size-6 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <CreditCard className="size-3 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    Deudas
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalDebt)}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">
                  {debts.length} deuda{debts.length !== 1 ? "s" : ""} activa
                  {debts.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-0 shadow-sm rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFinanceSubView("savings")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="size-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <PiggyBank className="size-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    Ahorros
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalSavings)}
                </p>
                <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(savingsPercentage, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {savingsPercentage}% de {formatCurrency(totalSavingsTarget)}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-0 shadow-sm rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFinanceSubView("recurring")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="size-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    Pagos Pendientes
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalRecurringPending)}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">
                  {recurringPending.length} pago
                  {recurringPending.length !== 1 ? "s" : ""} pendiente
                  {recurringPending.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case "accounts":
        return accounts.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Mis Cuentas
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollCarousel("left")}
                  className="size-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="size-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => scrollCarousel("right")}
                  className="size-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="size-3.5 text-gray-500" />
                </button>
              </div>
            </div>

            <DndContext
              sensors={handleSensors}
              collisionDetection={closestCenter}
              onDragStart={handleAccountDragStart}
              onDragEnd={handleAccountDragEnd}
            >
              <SortableContext
                items={sortedAccounts.map((a) => a.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div
                  ref={scrollRef}
                  className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {sortedAccounts.map((account) => (
                    <SortableAccountCard
                      key={account.id}
                      account={account}
                      onNavigate={handleAccountClick}
                    />
                  ))}

                  {/* Add account card */}
                  <motion.button
                    onClick={() => setShowAccountForm(true)}
                    className="shrink-0 snap-start"
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="w-[140px] h-[130px] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                      <Plus className="size-4 text-gray-400" />
                      <span className="text-[9px] text-gray-400 font-medium">
                        Nueva Cuenta
                      </span>
                    </div>
                  </motion.button>
                </div>
              </SortableContext>
              <DragOverlay>
                {activeAccountId ? (
                  <div className="w-[140px] rounded-2xl p-3 shadow-2xl opacity-90">
                    {(() => {
                      const acc = sortedAccounts.find(
                        (a) => a.id === activeAccountId
                      );
                      if (!acc) return null;
                      const Icon = typeIcons[acc.type] || Wallet;
                      const isNegative = acc.balance < 0;
                      return (
                        <div
                          className="rounded-2xl p-3"
                          style={{
                            background: `linear-gradient(145deg, ${acc.color}, ${acc.color}cc)`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="size-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                              <Icon className="size-3 text-white" />
                            </div>
                            <p className="text-[11px] font-medium text-white/90 truncate leading-tight">
                              {acc.name}
                            </p>
                          </div>
                          <p className="text-[15px] font-bold text-white tracking-tight">
                            {isNegative ? "-" : ""}
                            {formatCurrency(Math.abs(acc.balance))}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Hint text */}
            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1.5 text-center flex items-center justify-center gap-1">
              <GripVertical className="size-3" />
              Arrastra el ícono para reordenar
            </p>
          </div>
        ) : (
          <Card className="border-0 shadow-md rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg mb-4">
                <Wallet className="size-7 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                Sin cuentas aún
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Agrega tu primera cuenta para empezar a gestionar tus finanzas
              </p>
              <Button
                onClick={() => setShowAccountForm(true)}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500"
              >
                <Plus className="size-4 mr-1" />
                Crear Cuenta
              </Button>
            </CardContent>
          </Card>
        );

      case "yields":
        return highYieldAccounts.length > 0 ? (
          <YieldManager accounts={highYieldAccounts} yieldHistory={yieldHistory} />
        ) : null;

      case "alerts":
        return <SmartAlerts />;

      case "netWorth":
        return <NetWorthCard />;

      case "miniChart":
        return <FinanceMiniChart />;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const visibleWidgets = widgetConfig
    .sort((a, b) => a.order - b.order)
    .filter((w) => w.visible);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4 pb-24"
    >
      {/* Dashboard Widgets - Draggable via grip handle */}
      <DndContext
        sensors={handleSensors}
        collisionDetection={closestCenter}
        onDragStart={handleWidgetDragStart}
        onDragEnd={handleWidgetDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleWidgets.map((widget) => (
            <SortableWidgetItem key={widget.id} id={widget.id}>
              <motion.div variants={itemVariants}>
                {renderWidgetContent(widget.id)}
              </motion.div>
            </SortableWidgetItem>
          ))}
        </SortableContext>
        <DragOverlay>
          {activeWidgetId ? (
            <div className="opacity-80 shadow-2xl rounded-2xl">
              {renderWidgetContent(activeWidgetId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Hint text for widget drag */}
      <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-1">
        <GripVertical className="size-3" />
        Arrastra el ícono para reordenar secciones
      </p>

      {/* Customize Dashboard Button */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm rounded-2xl border-dashed">
          <CardContent className="p-3">
            <Button
              variant="ghost"
              className="w-full rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-xs gap-2"
              onClick={openCustomize}
            >
              <ArrowUpDown className="size-3.5" />
              Personalizar Dashboard
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* FAB - Add Transaction */}
      {accounts.length > 0 && (
        <motion.div
          className="fixed bottom-24 right-4 z-40"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Button
            onClick={() => setShowTransactionForm(true)}
            className="size-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
            size="icon"
          >
            <Plus className="size-6 text-white" />
          </Button>
        </motion.div>
      )}

      {/* Forms */}
      <AccountForm
        open={showAccountForm}
        onOpenChange={setShowAccountForm}
        onSuccess={fetchAll}
      />

      <TransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        onSuccess={fetchAll}
      />

      {/* Dashboard Customization Sheet */}
      <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh]">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <ArrowUpDown className="size-4 text-emerald-600" />
              Personalizar Dashboard
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-2 mb-6">
            <p className="text-xs text-gray-400 mb-3">
              Arrastra el ícono de agarre para reordenar. Activa o desactiva las
              secciones que quieras ver.
            </p>

            <DndContext
              sensors={handleSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSheetDragEnd}
            >
              <SortableContext
                items={tempConfig
                  .sort((a, b) => a.order - b.order)
                  .map((w) => w.id)}
                strategy={verticalListSortingStrategy}
              >
                {tempConfig
                  .sort((a, b) => a.order - b.order)
                  .map((widget, index) => (
                    <SortableSheetItem
                      key={widget.id}
                      widget={widget}
                      index={index}
                      onToggle={handleToggleWidget}
                    />
                  ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 sticky bottom-0 bg-white dark:bg-gray-950 pt-3 border-t dark:border-gray-800">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-xs"
              onClick={resetCustomization}
            >
              Restaurar
            </Button>
            <Button
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
              onClick={saveCustomization}
            >
              <Check className="size-4 mr-1" />
              Guardar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
