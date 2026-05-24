"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import type { MaintenanceServiceRule } from "@/lib/types/transport";
import { Gauge, Loader2, Search, Settings, Wrench } from "lucide-react";
import { toast } from "sonner";

interface MaintenanceRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type EditableRule = MaintenanceServiceRule & {
  intervalKmText: string;
  intervalMonthsText: string;
  warningKmText: string;
};

function toEditable(rule: MaintenanceServiceRule): EditableRule {
  return {
    ...rule,
    intervalKmText: rule.intervalKm != null ? String(Math.round(rule.intervalKm)) : "",
    intervalMonthsText: rule.intervalMonths != null ? String(rule.intervalMonths) : "",
    warningKmText: rule.warningKm != null ? String(Math.round(rule.warningKm)) : "500",
  };
}

function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function MaintenanceRulesDialog({ open, onOpenChange, onSuccess }: MaintenanceRulesDialogProps) {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    apiFetch<MaintenanceServiceRule[]>("/api/vehicles/maintenance/rules")
      .then((data) => {
        if (!cancelled) setRules((data || []).map(toEditable));
      })
      .catch((error) => {
        console.error("Error loading maintenance rules:", error);
        toast.error("No se pudieron cargar los intervalos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) => rule.name.toLowerCase().includes(query));
  }, [rules, search]);

  function updateRule(typeKey: string, patch: Partial<EditableRule>) {
    setRules((prev) => prev.map((rule) => rule.typeKey === typeKey ? { ...rule, ...patch } : rule));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/vehicles/maintenance/rules", {
        method: "PUT",
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            typeKey: rule.typeKey,
            name: rule.name,
            intervalKm: toNumberOrNull(rule.intervalKmText),
            intervalMonths: toNumberOrNull(rule.intervalMonthsText),
            warningKm: toNumberOrNull(rule.warningKmText),
            isActive: rule.isActive,
          })),
        }),
      });
      toast.success("Intervalos de mantenimiento guardados");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving maintenance rules:", error);
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los intervalos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b px-4 py-4 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="size-5 text-cyan-600" />
            Intervalos de mantenimiento
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define cada cuántos kilómetros o meses debe volver a aparecer cada recordatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-4 py-3 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar aceite, bujías, llantas..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Cargando intervalos...
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRules.map((rule) => (
                <div key={rule.typeKey} className="rounded-xl border p-3 dark:border-gray-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        <Wrench className="size-4 text-cyan-600" />
                        {rule.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {rule.isActive ? "Se creará recordatorio automático al registrarlo." : "No genera recordatorio automático."}
                      </p>
                    </div>
                    <Switch checked={rule.isActive} onCheckedChange={(checked) => updateRule(rule.typeKey, { isActive: checked })} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Cada km</Label>
                      <Input
                        type="number"
                        min="0"
                        value={rule.intervalKmText}
                        onChange={(event) => updateRule(rule.typeKey, { intervalKmText: event.target.value })}
                        placeholder="2500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cada meses</Label>
                      <Input
                        type="number"
                        min="0"
                        value={rule.intervalMonthsText}
                        onChange={(event) => updateRule(rule.typeKey, { intervalMonthsText: event.target.value })}
                        placeholder="6"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1 text-xs">
                        <Gauge className="size-3" />
                        Avisar km antes
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={rule.warningKmText}
                        onChange={(event) => updateRule(rule.typeKey, { warningKmText: event.target.value })}
                        placeholder="500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {filteredRules.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500">No encontré servicios con ese nombre.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1 bg-cyan-600 hover:bg-cyan-700" onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
