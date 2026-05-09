"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DaySelect } from "@/components/ui/day-select";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Calendar,
  Landmark,
  Bell,
  RefreshCw,
  Info,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Globe,
  Car,
  Trash2,
  Wallet,
  Database,
  UserX,
  Upload,
  FileSpreadsheet,
  Link,
  Lock,
  ChevronDown,
} from "lucide-react";
import { AccountManager } from "@/components/finance/account-manager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { signOut } from "next-auth/react";

interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  budgetCutoffDay: number;
  respectHolidays: boolean;
  countryCode: string;
  notificationsEnabled: boolean;
  lastBudgetReset: string | null;
  currentPeriod: {
    start: string;
    end: string;
  };
  needsBudgetReset: boolean;
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Section header component for accordion triggers
function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  badge,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`size-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`size-4 ${iconColor}`} />
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
      {badge && (
        <Badge variant="secondary" className="text-[10px] ml-auto mr-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {badge}
        </Badge>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { setActiveModule } = useAppStore();
  const { setTheme: applyTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showResetFinanceDialog, setShowResetFinanceDialog] = useState(false);
  const [showResetTransportDialog, setShowResetTransportDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [resettingTransport, setResettingTransport] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    result?: { total: number; created: number; skipped: number; errors: string[] };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<UserSettings>("/api/settings");
      setSettings(data);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err instanceof Error ? err.message : "Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: unknown) => {
    if (!settings) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await apiFetch<UserSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      });
      setSettings(updated);
      if (key === "theme" && typeof value === "string") {
        applyTheme(value);
      }
      setSaveMessage("Guardado");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error("Error updating setting:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetBudgets = async () => {
    setResetting(true);
    setResetResult(null);
    try {
      const result = await apiFetch<{ message: string; reset: boolean; count: number }>("/api/settings/reset-budgets", {
        method: "POST",
      });
      if (result.reset) {
        setResetResult(`Se reiniciaron ${result.count} presupuesto(s)`);
        fetchSettings();
      } else {
        setResetResult(result.message);
      }
      setTimeout(() => setResetResult(null), 4000);
    } catch (error) {
      console.error("Error resetting budgets:", error);
      setResetResult("Error al reiniciar presupuestos");
    } finally {
      setResetting(false);
    }
  };

  const handleResetAllFinanceData = async () => {
    setResettingAll(true);
    try {
      await apiFetch("/api/settings/reset-all-data", { method: "POST" });
      setResetResult("Todos los datos financieros eliminados");
      setShowResetFinanceDialog(false);
      setTimeout(() => setResetResult(null), 4000);
    } catch (error) {
      console.error("Error resetting all data:", error);
      setResetResult("Error al eliminar los datos");
    } finally {
      setResettingAll(false);
    }
  };

  const handleResetTransportData = async () => {
    setResettingTransport(true);
    try {
      await apiFetch("/api/settings/reset-transport", { method: "POST" });
      setResetResult("Datos de transporte eliminados");
      setShowResetTransportDialog(false);
      setTimeout(() => setResetResult(null), 4000);
    } catch (error) {
      console.error("Error resetting transport data:", error);
      setResetResult("Error al eliminar datos de transporte");
    } finally {
      setResettingTransport(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await apiFetch("/api/settings/delete-account", { method: "POST" });
      setShowDeleteAccountDialog(false);
      await signOut({ redirect: false });
      window.location.href = window.location.origin + "/";
    } catch (error) {
      console.error("Error deleting account:", error);
      setResetResult("Error al eliminar la cuenta");
      setDeletingAccount(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        setImportResult({ success: false });
        setImporting(false);
        return;
      }

      // Parse CSV: header + data rows
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        header.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return {
          modulo: row["modulo"] || row["módulo"] || "",
          campo1: row["campo1"] || row["nombre"] || "",
          campo2: row["campo2"] || row["tipo"] || "",
          campo3: row["campo3"] || row["monto"] || row["saldo"] || "",
          campo4: row["campo4"] || row["categoría"] || row["categoria"] || "",
          campo5: row["campo5"] || row["tasa"] || "",
          campo6: row["campo6"] || row["banco"] || "",
          campo7: row["campo7"] || "",
          campo8: row["campo8"] || "",
        };
      });

      const result = await apiFetch<{
        success: boolean;
        result: { total: number; created: number; skipped: number; errors: string[] };
      }>("/api/settings/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });

      setImportResult(result);
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({ success: false });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  if (!settings) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => setActiveModule("dashboard")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Ajustes</h1>
            <p className="text-xs text-gray-400">Configura tu experiencia en Qapital</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="p-6 text-center space-y-4">
            <div className="size-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">No se pudo cargar la configuración</p>
              <p className="text-xs text-gray-400 mt-1">{error || "Ocurrió un error inesperado"}</p>
            </div>
            <Button variant="outline" className="rounded-xl gap-2" onClick={fetchSettings}>
              <RefreshCw className="size-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => setActiveModule("dashboard")}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Ajustes</h1>
          <p className="text-xs text-gray-400">Configura tu experiencia en Qapital</p>
        </div>
        {saving && <Loader2 className="size-4 animate-spin text-emerald-500 ml-auto" />}
        {saveMessage && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            {saveMessage}
          </span>
        )}
      </div>

      {/* Global result message */}
      {resetResult && (
        <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{resetResult}</p>
        </div>
      )}

      {/* ===== ACCORDION SECTIONS ===== */}
      <Accordion type="multiple" defaultValue={["general", "finanzas"]} className="space-y-2">

        {/* ── GENERAL ── */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <AccordionItem value="general" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <SectionHeader icon={Globe} iconColor="text-emerald-600" iconBg="bg-emerald-100 dark:bg-emerald-900/30" title="General" />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              {/* Theme */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        {settings.theme === "light" ? <Sun className="size-3.5 text-violet-600 dark:text-violet-400" /> : settings.theme === "dark" ? <Moon className="size-3.5 text-violet-600 dark:text-violet-400" /> : <Monitor className="size-3.5 text-violet-600 dark:text-violet-400" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Tema</p>
                        <p className="text-[10px] text-gray-400">Apariencia de la aplicación</p>
                      </div>
                    </div>
                    <Select value={settings.theme} onValueChange={(val) => updateSetting("theme", val)}>
                      <SelectTrigger className="w-24 rounded-xl text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Oscuro</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Bell className="size-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Notificaciones</p>
                        <p className="text-[10px] text-gray-400">Recibir alertas y recordatorios</p>
                      </div>
                    </div>
                    <Switch checked={settings.notificationsEnabled} onCheckedChange={(val) => updateSetting("notificationsEnabled", val)} />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ── FINANZAS ── */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <AccordionItem value="finanzas" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <SectionHeader icon={Landmark} iconColor="text-teal-600" iconBg="bg-teal-100 dark:bg-teal-900/30" title="Finanzas" />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              {/* Budget Cutoff Day */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Calendar className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Día de corte del presupuesto</p>
                      <p className="text-[10px] text-gray-400">El día que inicia tu ciclo financiero mensual</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-1">
                    <Label className="text-xs text-gray-500 shrink-0">Día</Label>
                    <DaySelect value={settings.budgetCutoffDay} onValueChange={(d) => updateSetting("budgetCutoffDay", d)} placeholder="Día" className="w-24 rounded-xl h-9" />
                    <span className="text-[11px] text-gray-400">de cada mes</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2.5">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Período actual</p>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300">
                      {formatDateShort(settings.currentPeriod.start)} — {formatDateShort(settings.currentPeriod.end)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Respect Holidays */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                        <Info className="size-3.5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">Considerar días festivos</p>
                        <p className="text-[10px] text-gray-400">Mover corte a día hábil anterior</p>
                      </div>
                    </div>
                    <Switch checked={settings.respectHolidays} onCheckedChange={(val) => updateSetting("respectHolidays", val)} />
                  </div>
                </CardContent>
              </Card>

              {/* Reset Budgets */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <RefreshCw className="size-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Reiniciar presupuestos</p>
                      <p className="text-[10px] text-gray-400">Poner en $0 lo gastado</p>
                    </div>
                  </div>
                  {settings.needsBudgetReset && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-2 flex items-start gap-2">
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Tus presupuestos necesitan reiniciarse para el período actual.</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full rounded-xl text-xs gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/10 h-8" onClick={handleResetBudgets} disabled={resetting}>
                    {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Reiniciar Ahora
                  </Button>
                  {settings.lastBudgetReset && (
                    <p className="text-[10px] text-center text-gray-400">Último reinicio: {formatDateShort(settings.lastBudgetReset)}</p>
                  )}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ── GESTIÓN DE CUENTAS ── */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <AccordionItem value="cuentas" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <SectionHeader icon={Database} iconColor="text-teal-600" iconBg="bg-teal-100 dark:bg-teal-900/30" title="Gestión de Cuentas" />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <Landmark className="size-3.5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Cuentas registradas</p>
                      <p className="text-[10px] text-gray-400">Ver, editar y eliminar cuentas</p>
                    </div>
                  </div>
                  <AccountManager />
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ── CARGUE DE DATOS ── */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <AccordionItem value="cargue" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <SectionHeader icon={Upload} iconColor="text-indigo-600" iconBg="bg-indigo-100 dark:bg-indigo-900/30" title="Cargue de Datos" badge="Nuevo" />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">

              {/* Opción A: Archivo CSV - FUNCIONAL */}
              <Card className="border border-indigo-200 dark:border-indigo-800/40 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <FileSpreadsheet className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Importar desde CSV</p>
                      <p className="text-[10px] text-gray-400">Carga masiva de cuentas, presupuestos, deudas, metas y vehículos</p>
                    </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-2.5">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      Formato: CSV con columnas modulo, nombre, tipo, monto, categoría, tasa, banco. Descarga la plantilla para ver el formato exacto.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl text-xs gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 h-8"
                      onClick={() => {
                        // Download template CSV
                        const csv = `modulo,nombre,tipo,monto,categoría,tasa,banco
cuenta,Bancolombia Ahorros,checking,5000000,#10B981,,
cuenta,Nequi,digital_wallet,800000,#6366F1,,
presupuesto,Alimentación,expense,1500000,,
presupuesto,Transporte,expense,600000,,
deuda,Tarjeta Éxito,credit_card,8000000,,29.9,Éxito
deuda,Prestamo Vehicle,loan,35000000,,14.5,Bancolombia
meta,Emergencias,emergency_fund,10000000,2027-06-01,,
meta,Viaje Cancun,travel,5000000,2027-12-01,,
vehiculo,Pulsar 200NS,motorcycle,Bajaj,2020,,`;
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "qapital-plantilla.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <FileSpreadsheet className="size-3.5" />
                      Plantilla
                    </Button>
                    <Button
                      className="flex-1 rounded-xl text-xs gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      Importar CSV
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                  {importResult && (
                    <div className={`rounded-xl p-2.5 ${importResult.success ? "bg-emerald-50 dark:bg-emerald-900/10" : "bg-red-50 dark:bg-red-900/10"}`}>
                      {importResult.result ? (
                        <div className="text-[10px] space-y-1">
                          <p className={importResult.success ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                            {importResult.result.created} de {importResult.result.total} registros creados
                          </p>
                          {importResult.result.skipped > 0 && (
                            <p className="text-amber-600 dark:text-amber-400">{importResult.result.skipped} omitidos</p>
                          )}
                          {importResult.result.errors.length > 0 && (
                            <div className="text-red-500 space-y-0.5">
                              {importResult.result.errors.slice(0, 3).map((err, i) => (
                                <p key={i}>{err}</p>
                              ))}
                              {importResult.result.errors.length > 3 && (
                                <p>...y {importResult.result.errors.length - 3} errores más</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-red-600 dark:text-red-400">Error al procesar el archivo. Verifica el formato.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Opción B: Desde el Banco - PRÓXIMAMENTE */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl opacity-60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Link className="size-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Conectar con tu banco</p>
                      <p className="text-[10px] text-gray-400">Importa transacciones automáticamente desde tu entidad financiera</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Próximamente
                    </Badge>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs h-8 opacity-50 cursor-not-allowed" disabled>
                    <Lock className="size-3.5 mr-2" />
                    No disponible aún
                  </Button>
                </CardContent>
              </Card>

              {/* Opción C: Desde otra App - PRÓXIMAMENTE */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl opacity-60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Database className="size-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Migrar desde otra app</p>
                      <p className="text-[10px] text-gray-400">Importa tus datos de otras aplicaciones financieras</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Próximamente
                    </Badge>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs h-8 opacity-50 cursor-not-allowed" disabled>
                    <Lock className="size-3.5 mr-2" />
                    No disponible aún
                  </Button>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ── GESTIÓN DE DATOS ── */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <AccordionItem value="datos" className="border-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <SectionHeader icon={Trash2} iconColor="text-red-500" iconBg="bg-red-100 dark:bg-red-900/30" title="Gestión de Datos" />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              {/* Reset Finance Data */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Wallet className="size-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Eliminar datos financieros</p>
                      <p className="text-[10px] text-gray-400">Borra cuentas, transacciones, presupuestos, deudas y ahorros</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 h-8" onClick={() => setShowResetFinanceDialog(true)}>
                    <Trash2 className="size-3.5" />
                    Eliminar Todo
                  </Button>
                </CardContent>
              </Card>

              {/* Reset Transport Data */}
              <Card className="border border-gray-100 dark:border-gray-700/50 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Car className="size-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">Eliminar datos de transporte</p>
                      <p className="text-[10px] text-gray-400">Borra vehículos, combustible y mantenimiento</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 h-8" onClick={() => setShowResetTransportDialog(true)}>
                    <Trash2 className="size-3.5" />
                    Eliminar Datos de Transporte
                  </Button>
                </CardContent>
              </Card>

              {/* Delete Account */}
              <Card className="border border-red-200 dark:border-red-900/30 shadow-none rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <UserX className="size-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">Eliminar cuenta</p>
                      <p className="text-[10px] text-gray-400">Borra tu usuario y todos los datos de todos los módulos</p>
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-2">
                    <p className="text-[10px] text-red-600 dark:text-red-400">
                      Al eliminar tu cuenta se borrarán todos tus datos sin excepción. Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 h-8" onClick={() => setShowDeleteAccountDialog(true)}>
                    <UserX className="size-3.5" />
                    Eliminar Mi Cuenta
                  </Button>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>

      {/* ===== DIALOGS ===== */}

      {/* Reset Finance Dialog */}
      <AlertDialog open={showResetFinanceDialog} onOpenChange={setShowResetFinanceDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todos los datos financieros?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todas tus cuentas, transacciones, presupuestos, deudas, ahorros y pagos recurrentes. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-500 hover:bg-red-600" onClick={handleResetAllFinanceData} disabled={resettingAll}>
              {resettingAll ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Transport Dialog */}
      <AlertDialog open={showResetTransportDialog} onOpenChange={setShowResetTransportDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar datos de transporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todos los vehículos, registros de combustible y mantenimiento. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-500 hover:bg-red-600" onClick={handleResetTransportData} disabled={resettingTransport}>
              {resettingTransport ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center justify-center size-12 rounded-2xl bg-red-100 dark:bg-red-900/30 mx-auto mb-3">
              <UserX className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-center">¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-2">
              <span className="block">Esta acción eliminará <strong>permanentemente</strong> tu cuenta y <strong>todos</strong> tus datos: cuentas, transacciones, presupuestos, deudas, ahorros, vehículos, medicamentos, despensa y configuración.</span>
              <span className="block text-red-600 dark:text-red-400 font-medium">No se puede deshacer. Perderás acceso a toda tu información.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-xl" disabled={deletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={handleDeleteAccount} disabled={deletingAccount}>
              {deletingAccount ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Sí, eliminar mi cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* App Info */}
      <Card className="border-0 shadow-sm rounded-xl bg-gray-50 dark:bg-gray-800/30">
        <CardContent className="p-3 text-center">
          <div className="inline-flex items-center justify-center size-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm mb-1.5">
            <span className="text-[10px] font-bold text-white">Q</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-900 dark:text-white">Qapital</p>
          <p className="text-[9px] text-gray-400">v1.1.0</p>
        </CardContent>
      </Card>
    </div>
  );
}
