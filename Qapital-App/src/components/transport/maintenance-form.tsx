"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiFetch, getColombiaTodayString, formatCurrency } from "@/lib/api";
import type {
  Vehicle,
  MaintenanceRecord,
  MaintenanceItem,
  PaymentMethodType,
} from "@/lib/types/transport";
import { MAINTENANCE_TYPES } from "@/lib/types/transport";
import { PaymentMethodSelector } from "@/components/transport/payment-method-selector";
import { Loader2, Plus, X, Wrench, ShoppingCart, ChevronDown, Calculator } from "lucide-react";
import { toast } from "sonner";

// ─── Item shape for the itemized list ───

interface MaintenanceFormItem {
  id: string; // local-only key for React rendering
  name: string;
  quantity: number;
  unitPrice: string; // raw numeric string for CurrencyInput
  totalPrice: number; // auto-calculated
}

// ─── Helper: generate a simple local ID ───

let _nextItemId = 0;
function createItemId(): string {
  _nextItemId += 1;
  return `item-${_nextItemId}-${Date.now()}`;
}

function createEmptyItem(): MaintenanceFormItem {
  return {
    id: createItemId(),
    name: "",
    quantity: 1,
    unitPrice: "",
    totalPrice: 0,
  };
}

// ─── Component Props ───

interface MaintenanceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVehicleId?: string | null;
  record?: MaintenanceRecord | null;
  onSuccess?: () => void;
}

export function MaintenanceForm({
  open,
  onOpenChange,
  preselectedVehicleId,
  record,
  onSuccess,
}: MaintenanceFormProps) {
  // ─── Core form state ───
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState(preselectedVehicleId || "");
  const [type, setType] = useState("oil_change");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [km, setKm] = useState("");
  const [date, setDate] = useState(getColombiaTodayString());
  const [nextDueKm, setNextDueKm] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // ─── Itemized list state ───
  const [items, setItems] = useState<MaintenanceFormItem[]>([]);
  const [itemsOpen, setItemsOpen] = useState(false);

  // ─── Payment method state ───
  const [paymentData, setPaymentData] = useState<{
    paymentType: PaymentMethodType;
    accountId: string | null;
    subAccountId: string | null;
    debtId: string | null;
    installmentCount: number | null;
  }>({
    paymentType: "account",
    accountId: null,
    subAccountId: null,
    debtId: null,
    installmentCount: null,
  });

  const isEditing = !!record;

  // ─── Derived: sum of all item totals ───
  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPrice, 0),
    [items]
  );

  // ─── Derived: is cost auto-calculated from items? ───
  const hasItems = items.length > 0;

  // When items exist, the cost field mirrors the items total
  useEffect(() => {
    if (hasItems) {
      setCost(itemsTotal > 0 ? itemsTotal.toString() : "");
    }
    // When items are removed and no items remain, we leave the cost as-is
    // so the user can manually edit it again
  }, [itemsTotal, hasItems]);

  // ─── Fetch vehicles ───
  const fetchVehicles = useCallback(async () => {
    try {
      const data = await apiFetch<Vehicle[]>("/api/vehicles");
      setVehicles(data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchVehicles();
    }
  }, [open, fetchVehicles]);

  // ─── Pre-fill form when editing ───
  useEffect(() => {
    if (open && record) {
      setVehicleId(preselectedVehicleId || "");
      setType(record.type || "oil_change");
      setDescription(record.description || "");
      setCost(record.cost?.toString() || "");
      setKm(record.km?.toString() || "");
      setDate(record.date ? record.date.split("T")[0] : getColombiaTodayString());
      setNextDueKm(record.nextDueKm?.toString() || "");
      setNextDueDate(record.nextDueDate ? record.nextDueDate.split("T")[0] : "");
      setReminderEnabled(record.reminderEnabled ?? true);

      // Pre-fill items from existing record
      if (record.items && record.items.length > 0) {
        setItems(
          record.items.map((item: MaintenanceItem) => ({
            id: createItemId(),
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice,
          }))
        );
        setItemsOpen(true);
      } else {
        setItems([]);
      }

      // Pre-fill payment data
      setPaymentData({
        paymentType: record.debtId ? "credit_card" : "account",
        accountId: record.accountId || null,
        subAccountId: record.subAccountId || null,
        debtId: record.debtId || null,
        installmentCount: record.installmentCount || null,
      });
    }
  }, [open, record, preselectedVehicleId]);

  // ─── Auto-fill km when vehicle changes (create mode only) ───
  useEffect(() => {
    if (preselectedVehicleId && !isEditing) {
      setVehicleId(preselectedVehicleId);
      const vehicle = vehicles.find((v) => v.id === preselectedVehicleId);
      if (vehicle) {
        setKm(vehicle.currentKm.toString());
      }
    }
  }, [preselectedVehicleId, vehicles, isEditing]);

  useEffect(() => {
    if (vehicleId && !preselectedVehicleId && !isEditing) {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (vehicle) {
        setKm(vehicle.currentKm.toString());
      }
    }
  }, [vehicleId, vehicles, preselectedVehicleId, isEditing]);

  // ─── Auto-suggest next due km & date based on maintenance type (create mode only) ───
  useEffect(() => {
    if (!isEditing && type && km) {
      const currentKm = parseFloat(km) || 0;
      const typeConfig = MAINTENANCE_TYPES.find((t) => t.value === type);

      if (typeConfig) {
        // Auto-suggest next due KM
        if (typeConfig.nextKmInterval > 0) {
          setNextDueKm((currentKm + typeConfig.nextKmInterval).toString());
        } else {
          setNextDueKm("");
        }

        // Auto-suggest next due date
        if (typeConfig.nextMonthInterval > 0) {
          const baseDate = date ? new Date(date + "T12:00:00") : new Date();
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + typeConfig.nextMonthInterval);
          const yyyy = dueDate.getFullYear();
          const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
          const dd = String(dueDate.getDate()).padStart(2, "0");
          setNextDueDate(`${yyyy}-${mm}-${dd}`);
        } else {
          setNextDueDate("");
        }
      } else {
        setNextDueKm("");
        setNextDueDate("");
      }
    }
  }, [type, km, isEditing, date]);

  // ─── Item handlers ───

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
    setItemsOpen(true);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const updateItem = useCallback(
    (itemId: string, field: keyof MaintenanceFormItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;

          const updated = { ...item, [field]: value };

          // Recalculate total when quantity or unitPrice changes
          if (field === "quantity" || field === "unitPrice") {
            const qty = field === "quantity" ? Number(value) || 0 : item.quantity;
            const price =
              field === "unitPrice"
                ? parseFloat(String(value)) || 0
                : parseFloat(item.unitPrice) || 0;
            updated.totalPrice = qty * price;
          }

          return updated;
        })
      );
    },
    []
  );

  // ─── Submit handler ───

  const handleSubmit = async () => {
    if (!vehicleId || !description || !cost) return;
    setLoading(true);
    try {
      // Build items payload (only include items with valid name & price)
      const itemsPayload = items
        .filter((i) => i.name.trim() !== "" && parseFloat(i.unitPrice) > 0)
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity,
          unitPrice: parseFloat(i.unitPrice) || 0,
          totalPrice: i.totalPrice,
        }));

      const payload: Record<string, unknown> = {
        type,
        description,
        cost: parseFloat(cost),
        km: km ? parseFloat(km) : undefined,
        date,
        nextDueKm: nextDueKm ? parseFloat(nextDueKm) : undefined,
        nextDueDate: nextDueDate || undefined,
        reminderEnabled,
        // ── Itemized list ──
        ...(itemsPayload.length > 0 ? { items: itemsPayload } : {}),
        // ── Finance integration ──
        paymentType: paymentData.paymentType,
        accountId: paymentData.accountId,
        subAccountId: paymentData.subAccountId,
        debtId: paymentData.debtId,
        installmentCount: paymentData.installmentCount,
      };

      if (isEditing && record) {
        await apiFetch(
          `/api/vehicles/${vehicleId}/maintenance/${record.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        toast.success("Mantenimiento actualizado", {
          description: "Los cambios se guardaron correctamente",
        });
      } else {
        await apiFetch(`/api/vehicles/${vehicleId}/maintenance`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success("Mantenimiento registrado", {
          description: "El registro de mantenimiento se guardó correctamente",
        });
      }

      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving maintenance record:", error);
      toast.error(isEditing ? "Error al actualizar" : "Error al registrar", {
        description:
          "No se pudo guardar el registro de mantenimiento. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (!isEditing) {
      setVehicleId(preselectedVehicleId || "");
      setType("oil_change");
      setDescription("");
      setCost("");
      setKm("");
      setDate(getColombiaTodayString());
      setNextDueKm("");
      setNextDueDate("");
      setReminderEnabled(true);
      setItems([]);
      setItemsOpen(false);
      setPaymentData({
        paymentType: "account",
        accountId: null,
        subAccountId: null,
        debtId: null,
        installmentCount: null,
      });
    }
  };

  // ─── Selected vehicle info ───
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="size-5 text-cyan-600" />
            {isEditing ? "Editar Mantenimiento" : "Registrar Mantenimiento"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-6">
          {/* ─── 1. Vehicle Selector ─── */}
          <div className="space-y-2">
            <Label>Vehículo</Label>
            {vehicles.length === 1 || isEditing ? (
              <div className="h-10 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
                <Wrench className="size-4 text-cyan-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedVehicle?.name || vehicles[0]?.name || "Vehículo"}
                </span>
                {selectedVehicle?.plate && (
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {selectedVehicle.plate}
                  </span>
                )}
              </div>
            ) : (
              <Select
                value={vehicleId}
                onValueChange={setVehicleId}
                disabled={isEditing}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ─── 2. Maintenance Type ─── */}
          <div className="space-y-2">
            <Label>Tipo de mantenimiento</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ─── 3. Description ─── */}
          <div className="space-y-2">
            <Label htmlFor="maint-desc">Descripción</Label>
            <Textarea
              id="maint-desc"
              placeholder="Ej: Cambio de aceite sintético 10W-40"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl min-h-[60px]"
            />
          </div>

          {/* ─── 4. Items List (collapsible) ─── */}
          <Collapsible open={itemsOpen} onOpenChange={setItemsOpen}>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header / Trigger */}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-cyan-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Items del mantenimiento
                    </span>
                    {items.length > 0 && (
                      <span className="text-[10px] font-semibold bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`size-4 text-gray-400 transition-transform ${
                      itemsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="p-3 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">
                      Agrega items para detallar el mantenimiento
                    </p>
                  ) : (
                    items.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-900/30 p-2.5 space-y-2"
                      >
                        {/* Item header row: index + delete */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            Item {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>

                        {/* Name */}
                        <Input
                          placeholder="Nombre del item"
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.id, "name", e.target.value)
                          }
                          className="rounded-lg h-8 text-sm"
                        />

                        {/* Quantity & Unit Price */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[9px] text-gray-400">
                              Cantidad
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "quantity",
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              className="rounded-lg h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] text-gray-400">
                              Precio unit.
                            </Label>
                            <CurrencyInput
                              showPrefix
                              placeholder="0"
                              value={item.unitPrice}
                              onChange={(v) =>
                                updateItem(item.id, "unitPrice", v)
                              }
                              className="rounded-lg h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Total */}
                        {item.totalPrice > 0 && (
                          <div className="flex items-center justify-end gap-1 pt-0.5">
                            <Calculator className="size-3 text-gray-400" />
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                              Subtotal: {formatCurrency(item.totalPrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Add item button */}
                  <button
                    type="button"
                    onClick={addItem}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-cyan-600 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors text-xs font-medium"
                  >
                    <Plus className="size-3.5" />
                    Agregar item
                  </button>

                  {/* Items total summary */}
                  {hasItems && itemsTotal > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        Total items
                      </span>
                      <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">
                        {formatCurrency(itemsTotal)}
                      </span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* ─── 5. Cost & KM ─── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maint-cost">
                Costo{" "}
                {hasItems && (
                  <span className="text-[9px] text-cyan-500 font-normal">
                    (auto)
                  </span>
                )}
              </Label>
              <CurrencyInput
                id="maint-cost"
                showPrefix
                placeholder="85000"
                value={cost}
                onChange={(v) => setCost(v)}
                className="rounded-xl"
                disabled={hasItems}
              />
              {hasItems && (
                <p className="text-[9px] text-gray-400">
                  Calculado automáticamente desde los items
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-km">Kilometraje</Label>
              <Input
                id="maint-km"
                type="number"
                placeholder="Ej: 15000"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* ─── 6. Date ─── */}
          <div className="space-y-2">
            <Label htmlFor="maint-date">Fecha</Label>
            <Input
              id="maint-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* ─── 7. Next Due (KM + Date) + Reminder Toggle ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Próximo mantenimiento
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="maint-nextkm"
                  className="text-[10px] text-gray-500"
                >
                  KM próx. cambio
                </Label>
                <Input
                  id="maint-nextkm"
                  type="number"
                  placeholder="Ej: 20000"
                  value={nextDueKm}
                  onChange={(e) => setNextDueKm(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="maint-nextdate"
                  className="text-[10px] text-gray-500"
                >
                  Fecha próx. cambio
                </Label>
                <Input
                  id="maint-nextdate"
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Reminder Switch */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <Label className="text-sm">Recordatorio</Label>
              <p className="text-[10px] text-gray-400">
                Recibir aviso del próximo mantenimiento
              </p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
            />
          </div>

          {/* ─── 8. Payment Method Selector ─── */}
          <PaymentMethodSelector
            vehicleId={vehicleId}
            defaultPaymentType={record?.debtId ? "credit_card" : "account"}
            defaultAccountId={record?.accountId}
            defaultSubAccountId={record?.subAccountId}
            defaultDebtId={record?.debtId}
            defaultInstallmentCount={record?.installmentCount}
            onChange={setPaymentData}
          />

          {/* ─── 9. Submit Button ─── */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !vehicleId || !description || !cost}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : null}
            {isEditing ? "Guardar Cambios" : "Registrar Mantenimiento"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
