"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const vehicleTypes = [
  { value: "motorcycle", label: "Motocicleta" },
  { value: "car", label: "Carro" },
  { value: "truck", label: "Camión" },
  { value: "other", label: "Otro" },
];

const fuelTypes = [
  { value: "gasoline", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "electric", label: "Eléctrico" },
];

interface VehicleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: {
    id: string;
    name: string;
    type: string;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    color?: string | null;
    tankCapacity?: number | null;
    fuelType?: string | null;
    currentKm: number;
  } | null;
  onSuccess?: () => void;
}

export function VehicleForm({ open, onOpenChange, vehicle, onSuccess }: VehicleFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(vehicle?.name || "");
  const [type, setType] = useState(vehicle?.type || "motorcycle");
  const [brand, setBrand] = useState(vehicle?.brand || "");
  const [model, setModel] = useState(vehicle?.model || "");
  const [year, setYear] = useState(vehicle?.year?.toString() || "");
  const [color, setColor] = useState(vehicle?.color || "");
  const [tankCapacity, setTankCapacity] = useState(vehicle?.tankCapacity?.toString() || "");
  const [fuelType, setFuelType] = useState(vehicle?.fuelType || "gasoline");
  const [currentKm, setCurrentKm] = useState(vehicle?.currentKm?.toString() || "0");

  // Sync form state when vehicle prop changes (e.g., editing a different vehicle)
  useEffect(() => {
    if (open) {
      setName(vehicle?.name || "");
      setType(vehicle?.type || "motorcycle");
      setBrand(vehicle?.brand || "");
      setModel(vehicle?.model || "");
      setYear(vehicle?.year?.toString() || "");
      setColor(vehicle?.color || "");
      setTankCapacity(vehicle?.tankCapacity?.toString() || "");
      setFuelType(vehicle?.fuelType || "gasoline");
      setCurrentKm(vehicle?.currentKm?.toString() || "0");
      setError(null);
    }
  }, [vehicle, open]);

  const isEditing = !!vehicle;

  const handleSubmit = async () => {
    if (!name) return;
    setError(null);
    setLoading(true);
    try {
      const data = {
        name,
        type,
        brand: brand || null,
        model: model || null,
        year: year ? Number(year) : null,
        color: color || null,
        tankCapacity: tankCapacity ? Number(tankCapacity) : null,
        fuelType,
        currentKm: currentKm ? Number(currentKm) : 0,
      };

      if (isEditing) {
        await apiFetch(`/api/vehicles/${vehicle.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        toast.success("Vehículo actualizado", {
          description: "Los cambios se guardaron correctamente",
        });
      } else {
        await apiFetch("/api/vehicles", {
          method: "POST",
          body: JSON.stringify(data),
        });
        toast.success("Vehículo creado", {
          description: "El vehículo se registró correctamente",
        });
      }

      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error("Error saving vehicle:", err);
      setError(err instanceof Error ? err.message : "Error al guardar vehículo");
      toast.error("Error al guardar", {
        description: "No se pudo guardar el vehículo. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (!vehicle) {
      setName("");
      setType("motorcycle");
      setBrand("");
      setModel("");
      setYear("");
      setColor("");
      setTankCapacity("");
      setFuelType("gasoline");
      setCurrentKm("0");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Vehículo" : "Nuevo Vehículo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-name">Nombre</Label>
            <Input
              id="vehicle-name"
              placeholder="Ej: Mi Moto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vehicle-brand">Marca</Label>
              <Input
                id="vehicle-brand"
                placeholder="Ej: Honda"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-model">Modelo</Label>
              <Input
                id="vehicle-model"
                placeholder="Ej: CB 190R"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Year & Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vehicle-year">Año</Label>
              <Input
                id="vehicle-year"
                type="number"
                placeholder="Ej: 2023"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-color">Color</Label>
              <Input
                id="vehicle-color"
                placeholder="Ej: Rojo"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Tank Capacity & Fuel Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vehicle-tank">Capacidad del tanque (galones)</Label>
              <Input
                id="vehicle-tank"
                type="number"
                step="0.1"
                placeholder="Ej: 4.5"
                value={tankCapacity}
                onChange={(e) => setTankCapacity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de combustible</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current KM */}
          <div className="space-y-2">
            <Label htmlFor="vehicle-km">Kilometraje actual</Label>
            <Input
              id="vehicle-km"
              type="number"
              placeholder="0"
              value={currentKm}
              onChange={(e) => setCurrentKm(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="size-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !name}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : null}
            {isEditing ? "Guardar Cambios" : "Crear Vehículo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
