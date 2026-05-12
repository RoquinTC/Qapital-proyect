"use client";

import { formatCurrency, formatDate } from "@/lib/api";
import { Bike, Car, Truck, HelpCircle, Fuel, Wrench, AlertTriangle, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import { FuelGauge } from "./Fuel-gauge";

interface VehicleCardProps {
  vehicle: {
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
    fuelLogs: Array<{
      id: string;
      date: string;
      km: number;
      amount: number;
      pricePerGallon: number;
      gallons: number;
    }>;
    maintenanceRecords: Array<{
      id: string;
      type: string;
      description: string;
      km: number;
      nextDueKm?: number | null;
      nextDueDate?: string | null;
    }>;
    fuelLevel?: number;
    currentFuel?: number;
  };
  onClick?: () => void;
}

const vehicleIcons: Record<string, typeof Car> = {
  motorcycle: Bike,
  car: Car,
  truck: Truck,
  other: HelpCircle,
};

const vehicleGradients: Record<string, string> = {
  motorcycle: "from-cyan-500 to-blue-600",
  car: "from-blue-500 to-indigo-600",
  truck: "from-indigo-500 to-purple-600",
  other: "from-slate-500 to-gray-600",
};

const vehicleTypeLabels: Record<string, string> = {
  motorcycle: "Moto",
  car: "Carro",
  truck: "Camión",
  other: "Otro",
};

const fuelTypeLabels: Record<string, string> = {
  gasoline: "Gasolina",
  diesel: "Diésel",
  electric: "Eléctrico",
};

export function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const Icon = vehicleIcons[vehicle.type] || Car;
  const gradient = vehicleGradients[vehicle.type] || vehicleGradients.other;
  const lastFuelLog = vehicle.fuelLogs?.[0];
  const nextMaintenance = vehicle.maintenanceRecords?.[0];

  // Determine maintenance status
  let maintenanceStatus: "ok" | "warning" | "overdue" = "ok";
  if (nextMaintenance?.nextDueKm && vehicle.currentKm) {
    const kmRemaining = nextMaintenance.nextDueKm - vehicle.currentKm;
    if (kmRemaining <= 0) maintenanceStatus = "overdue";
    else if (kmRemaining <= 500) maintenanceStatus = "warning";
  }

  const statusColors = {
    ok: "bg-emerald-500",
    warning: "bg-amber-500",
    overdue: "bg-red-500",
  };

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left"
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${gradient} p-4 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon className="size-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{vehicle.name}</h3>
                <span className="text-[10px] text-white/70">
                  {vehicle.brand && vehicle.model
                    ? `${vehicle.brand} ${vehicle.model}`
                    : vehicleTypeLabels[vehicle.type] || vehicle.type}
                  {vehicle.year ? ` ${vehicle.year}` : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {vehicle.fuelType && (
                <span className="text-[9px] bg-white/20 backdrop-blur-sm text-white rounded-full px-2 py-0.5">
                  {fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}
                </span>
              )}
              <div className={`size-2.5 rounded-full ${statusColors[maintenanceStatus]}`} title={
                maintenanceStatus === "overdue" ? "Mantenimiento vencido" :
                  maintenanceStatus === "warning" ? "Mantenimiento próximo" : "Al día"
              } />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Fuel Gauge */}
          {vehicle.tankCapacity && (
            <div className="flex justify-center py-2">
              <FuelGauge
                fuelLevel={vehicle.fuelLevel ?? 0}
                vehicleType={vehicle.type}
                tankCapacity={vehicle.tankCapacity}
                currentFuel={vehicle.currentFuel}
                showDetails={false}
              />
            </div>
          )}

          {/* KM Display */}
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-gray-400" />
            <span className="text-xs text-gray-500">Kilometraje</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white ml-auto">
              {vehicle.currentKm.toLocaleString("es-CO")} km
            </span>
          </div>

          {/* Last Fuel Log */}
          {lastFuelLog && (
            <div className="flex items-center gap-2 text-gray-500">
              <Fuel className="size-3.5 text-cyan-500" />
              <span className="text-[11px]">
                Última recarga: {formatDate(lastFuelLog.date)} • {formatCurrency(lastFuelLog.amount)}
              </span>
            </div>
          )}

          {/* Next Maintenance */}
          {nextMaintenance?.nextDueKm && (
            <div className="flex items-center gap-2 text-gray-500">
              <Wrench className={`size-3.5 ${maintenanceStatus === "overdue" ? "text-red-500" : maintenanceStatus === "warning" ? "text-amber-500" : "text-emerald-500"}`} />
              <span className="text-[11px]">
                Próx. mantenimiento: {nextMaintenance.nextDueKm.toLocaleString("es-CO")} km
              </span>
              {maintenanceStatus !== "ok" && (
                <AlertTriangle className={`size-3.5 ml-auto ${maintenanceStatus === "overdue" ? "text-red-500" : "text-amber-500"}`} />
              )}
            </div>
          )}

          {/* Tank capacity badge */}
          {vehicle.tankCapacity && (
            <div className="flex items-center gap-1 pt-1">
              <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-2 py-0.5">
                Tanque: {vehicle.tankCapacity} gal
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}