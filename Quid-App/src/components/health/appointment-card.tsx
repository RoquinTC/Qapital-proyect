"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AppointmentCardProps {
  appointment: {
    id: string;
    doctorName?: string | null;
    specialty?: string | null;
    location?: string | null;
    date: string;
    notes?: string | null;
    reminderEnabled: boolean;
    status: string;
  };
  onClick?: () => void;
  highlighted?: boolean;
}

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: "Programada", color: "text-emerald-700 dark:text-emerald-300", bgColor: "bg-emerald-50 dark:bg-emerald-900/20" },
  completed: { label: "Completada", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-700" },
  cancelled: { label: "Cancelada", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-900/20" },
};

export function AppointmentCard({ appointment, onClick, highlighted }: AppointmentCardProps) {
  const date = new Date(appointment.date);
  const statusInfo = statusLabels[appointment.status] || statusLabels.scheduled;

  const day = date.getDate();
  const month = date.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  const timeStr = date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left"
      whileTap={{ scale: 0.98 }}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border transition-shadow ${
        highlighted ? "ring-2 ring-violet-200 dark:ring-violet-900/60 shadow-md" : ""
      } ${
        appointment.status === "cancelled"
          ? "border-red-100 dark:border-red-900/30 opacity-70"
          : appointment.status === "completed"
          ? "border-gray-100 dark:border-gray-700"
          : "border-emerald-100 dark:border-emerald-900/30"
      }`}>
        <div className="flex items-start gap-3">
          {/* Date icon */}
          <div className={`size-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
            appointment.status === "scheduled"
              ? "bg-gradient-to-br from-emerald-500 to-teal-500"
              : appointment.status === "completed"
              ? "bg-gray-300 dark:bg-gray-600"
              : "bg-red-400"
          }`}>
            <span className="text-xs font-bold text-white leading-none">{day}</span>
            <span className="text-[10px] text-white/80 uppercase">{month}</span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  {appointment.doctorName ? (
                    <>
                    <User className="size-3.5 text-gray-400" />
                    {appointment.doctorName}
                    </>
                  ) : (
                    appointment.specialty || "Cita médica"
                  )}
                </h3>
                {appointment.specialty && (
                  <span className="block truncate text-xs text-gray-500">{appointment.specialty}</span>
                )}
              </div>
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border-0 text-xs shrink-0`}>
                {statusInfo.label}
              </Badge>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3 text-gray-400" />
              <span className="text-xs text-gray-500">{timeStr}</span>
              </span>
              {appointment.location && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3 text-gray-400" />
                <span className="text-xs text-gray-500 truncate">{appointment.location}</span>
              </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
