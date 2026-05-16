"use client";

import { useAppStore, type TransportSubView } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Fuel, Wrench, Trash2 } from "lucide-react";
import { VehiclesView } from "./vehicles-view";
import { FuelView } from "./fuel-view";
import { MaintenanceView } from "./maintenance-view";
import { VehicleDetail } from "./vehicle-detail";
import { Button } from "@/components/ui/button";
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
import { apiFetch } from "@/lib/api";
import { useState } from "react";

const tabs: { id: TransportSubView; label: string; icon: typeof Car }[] = [
  { id: "vehicles", label: "Vehículos", icon: Car },
  { id: "fuel", label: "Combustible", icon: Fuel },
  { id: "maintenance", label: "Mantenimiento", icon: Wrench },
];

export function TransportPage() {
  const { transportSubView, setTransportSubView } = useAppStore();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const showDetail = selectedVehicleId !== null;

  const handleResetTransport = async () => {
    setResetting(true);
    try {
      await apiFetch("/api/settings/reset-transport", { method: "POST" });
      setSelectedVehicleId(null);
      setShowResetDialog(false);
      // Force page refresh to show cleared data
      window.location.reload();
    } catch (error) {
      console.error("Error resetting transport data:", error);
    } finally {
      setResetting(false);
    }
  };

  const renderContent = () => {
    if (showDetail) {
      return (
        <VehicleDetail
          vehicleId={selectedVehicleId}
          onBack={() => setSelectedVehicleId(null)}
        />
      );
    }

    switch (transportSubView) {
      case "vehicles":
        return <VehiclesView onSelectVehicle={(id) => setSelectedVehicleId(id)} />;
      case "fuel":
        return <FuelView onSelectVehicle={(id) => setSelectedVehicleId(id)} />;
      case "maintenance":
        return <MaintenanceView onSelectVehicle={(id) => setSelectedVehicleId(id)} />;
      default:
        return <VehiclesView onSelectVehicle={(id) => setSelectedVehicleId(id)} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab navigation */}
      {!showDetail && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
            {tabs.map((tab) => {
              const isActive = transportSubView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTransportSubView(tab.id)}
                  className="relative flex items-center justify-center gap-1.5 flex-1 py-2.5 px-2 rounded-xl text-sm font-medium transition-colors duration-200"
                >
                  {isActive && (
                    <motion.div
                      layoutId="transportTab"
                      className="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  )}
                  <Icon
                    className={`size-4 relative z-10 ${
                      isActive ? "text-cyan-600" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`relative z-10 text-xs ${
                      isActive ? "text-gray-900 dark:text-white" : "text-gray-500"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Reset button */}
          <div className="flex justify-end mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 h-7 px-2"
              onClick={() => setShowResetDialog(true)}
            >
              <Trash2 className="size-3 mr-1" />
              Limpiar Todo
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={showDetail ? `detail-${selectedVehicleId}` : transportSubView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reset Transport Data Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todos los datos de transporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los vehículos, registros de combustible, registros de mantenimiento y transacciones asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetTransport}
              disabled={resetting}
              className="rounded-xl bg-red-500 hover:bg-red-600"
            >
              {resetting ? "Eliminando..." : "Eliminar Todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
