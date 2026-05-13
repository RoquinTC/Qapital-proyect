"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileJson,
  Info,
} from "lucide-react";

interface BackupMetadata {
  magic: string;
  version: number;
  exportDate: string;
  userEmail: string;
  userName: string;
  currency: string;
}

export function BackupManager() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    error?: string;
    stats?: Record<string, number>;
  } | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupMetadata | null>(null);
  const [pendingBackupRaw, setPendingBackupRaw] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const response = await fetch("/api/backup/export");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al exportar");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition header, or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `qapital-backup-${new Date().toISOString().split("T")[0]}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) {
          filename = match[1].replace(/['"]/g, "");
        }
      }
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportResult("Respaldo descargado exitosamente");
      setTimeout(() => setExportResult(null), 4000);
    } catch (error) {
      console.error("Export error:", error);
      setExportResult(
        error instanceof Error ? error.message : "Error al exportar el respaldo"
      );
      setTimeout(() => setExportResult(null), 5000);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Quick validation before showing dialog
      if (data.magic !== "qapital-backup") {
        setImportResult({
          success: false,
          error: "Este archivo no es un respaldo válido de Qapital",
        });
        setTimeout(() => setImportResult(null), 5000);
        return;
      }

      // Store the backup metadata and raw text for later import
      setPendingBackup({
        magic: data.magic,
        version: data.version,
        exportDate: data.exportDate,
        userEmail: data.userEmail,
        userName: data.userName,
        currency: data.currency,
      });
      setPendingBackupRaw(text);
      setShowImportDialog(true);
    } catch {
      setImportResult({
        success: false,
        error: "No se pudo leer el archivo. Verifica que sea un archivo JSON válido.",
      });
      setTimeout(() => setImportResult(null), 5000);
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pendingBackupRaw) return;
    setShowImportDialog(false);
    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingBackupRaw,
      });

      const data = await response.json();

      if (data.success) {
        setImportResult({ success: true, stats: data.stats });
      } else {
        setImportResult({ success: false, error: data.error });
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        error: "Error de conexión al importar el respaldo",
      });
    } finally {
      setImporting(false);
      setPendingBackup(null);
      setPendingBackupRaw(null);
    }
  };

  const cancelImport = () => {
    setShowImportDialog(false);
    setPendingBackup(null);
    setPendingBackupRaw(null);
  };

  const formatBackupDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  const getTotalRecords = (stats?: Record<string, number>) => {
    if (!stats) return 0;
    return Object.values(stats).reduce((sum, count) => sum + count, 0);
  };

  return (
    <Card className="border border-amber-200 dark:border-amber-800/40 shadow-none rounded-xl">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Respaldo y Recuperación
            </p>
            <p className="text-[10px] text-gray-400">
              Exporta o restaura todos tus datos
            </p>
          </div>
          <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
            Nuevo
          </Badge>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <Info className="size-3 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-600 dark:text-blue-400">
              El respaldo guarda <strong>todos</strong> tus datos: cuentas, transacciones, presupuestos, deudas, ahorros, vehículos y más.
              Útil para recuperar tu información si cambias de dispositivo o la base de datos falla.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl text-xs gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 h-8"
            onClick={handleExport}
            disabled={exporting || importing}
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Exportar Respaldo
          </Button>
          <Button
            className="flex-1 rounded-xl text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={exporting || importing}
          >
            {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Importar Respaldo
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Export result */}
        {exportResult && (
          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2.5 flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
              {exportResult}
            </p>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div
            className={`rounded-xl p-2.5 ${
              importResult.success
                ? "bg-emerald-50 dark:bg-emerald-900/10"
                : "bg-red-50 dark:bg-red-900/10"
            }`}
          >
            {importResult.success ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Respaldo restaurado exitosamente
                  </p>
                </div>
                {importResult.stats && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-emerald-600/70 dark:text-emerald-400/70 pl-5">
                    {importResult.stats.accounts > 0 && <span>{importResult.stats.accounts} cuentas</span>}
                    {importResult.stats.transactions > 0 && <span>{importResult.stats.transactions} transacciones</span>}
                    {importResult.stats.budgets > 0 && <span>{importResult.stats.budgets} presupuestos</span>}
                    {importResult.stats.debts > 0 && <span>{importResult.stats.debts} deudas</span>}
                    {importResult.stats.savingsGoals > 0 && <span>{importResult.stats.savingsGoals} metas de ahorro</span>}
                    {importResult.stats.cdts > 0 && <span>{importResult.stats.cdts} CDTs</span>}
                    {importResult.stats.vehicles > 0 && <span>{importResult.stats.vehicles} vehículos</span>}
                    {importResult.stats.installments > 0 && <span>{importResult.stats.installments} cuotas</span>}
                    {importResult.stats.recurringPayments > 0 && <span>{importResult.stats.recurringPayments} pagos recurrentes</span>}
                    {importResult.stats.categories > 0 && <span>{importResult.stats.categories} categorías</span>}
                  </div>
                )}
                <p className="text-[9px] text-amber-600 dark:text-amber-400 pl-5">
                  Recarga la página para ver los datos actualizados.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-600 dark:text-red-400">
                  {importResult.error || "Error al importar el respaldo"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Importing progress */}
        {importing && (
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-2.5 flex items-center gap-2">
            <Loader2 className="size-3.5 text-amber-500 animate-spin shrink-0" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Restaurando respaldo... Esto puede tardar unos segundos.
            </p>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={(open) => !open && cancelImport()}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <FileJson className="size-5 text-amber-500" />
              Confirmar Restauración
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Estás a punto de restaurar un respaldo. <strong>Esto eliminará todos los datos actuales</strong> y los reemplazará con los del archivo.
                </p>
                {pendingBackup && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Usuario:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pendingBackup.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Email:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pendingBackup.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Fecha:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatBackupDate(pendingBackup.exportDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Versión:</span>
                      <Badge variant="secondary" className="text-[9px]">v{pendingBackup.version}</Badge>
                    </div>
                  </div>
                )}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-2.5 flex items-start gap-2">
                  <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    Esta acción no se puede deshacer. Asegúrate de tener un respaldo de tus datos actuales si los necesitas.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmImport}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
            >
              Restaurar Respaldo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
