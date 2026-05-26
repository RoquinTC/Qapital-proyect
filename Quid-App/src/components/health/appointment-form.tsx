"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface AppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: {
    id: string;
    doctorName?: string | null;
    specialty?: string | null;
    location?: string | null;
    date: string;
    notes?: string | null;
    reminderEnabled: boolean;
    status: string;
    copayAmount?: number | null;
  } | null;
  onSuccess?: () => void | Promise<void>;
}

const specialtyOptions = [
  "Alergología",
  "Anestesiología",
  "Audiología",
  "Cirugía General",
  "Cirugía Maxilofacial",
  "Cirugía Plástica",
  "Medicina General",
  "Cardiología",
  "Coloproctología",
  "Dermatología",
  "Endocrinología",
  "Fisiatría",
  "Fisioterapia",
  "Gastroenterología",
  "Genética",
  "Geriatría",
  "Ginecología",
  "Hematología",
  "Infectología",
  "Medicina Interna",
  "Nefrología",
  "Neumología",
  "Neurología",
  "Nutrición",
  "Odontología",
  "Oftalmología",
  "Oncología",
  "Ortopedia",
  "Otorrinolaringología",
  "Pediatría",
  "Psicología",
  "Psiquiatría",
  "Radiología",
  "Reumatología",
  "Terapia Ocupacional",
  "Traumatología",
  "Urología",
  "Otra",
];

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function AppointmentForm({ open, onOpenChange, appointment, onSuccess }: AppointmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState(appointment?.doctorName || "");
  const [specialty, setSpecialty] = useState(appointment?.specialty || "");
  const [location, setLocation] = useState(appointment?.location || "");
  const [dateStr, setDateStr] = useState(() => {
    if (appointment?.date) {
      return toLocalDateTimeInput(appointment.date);
    }
    return "";
  });
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [copayAmount, setCopayAmount] = useState(
    appointment?.copayAmount != null ? String(appointment.copayAmount) : ""
  );
  const [reminderEnabled, setReminderEnabled] = useState(appointment?.reminderEnabled ?? true);

  const isEditing = !!appointment;

  useEffect(() => {
    if (!open) return;
    setDoctorName(appointment?.doctorName || "");
    setSpecialty(appointment?.specialty || "");
    setLocation(appointment?.location || "");
    setDateStr(appointment?.date ? toLocalDateTimeInput(appointment.date) : "");
    setNotes(appointment?.notes || "");
    setCopayAmount(appointment?.copayAmount != null ? String(appointment.copayAmount) : "");
    setReminderEnabled(appointment?.reminderEnabled ?? true);
  }, [appointment, open]);

  const handleSubmit = async () => {
    if (!dateStr) return;
    setLoading(true);
    try {
      const data = {
        doctorName: doctorName || null,
        specialty: specialty || null,
        location: location || null,
        date: new Date(dateStr).toISOString(),
        notes: notes || null,
        copayAmount: copayAmount ? Number(copayAmount) : null,
        reminderEnabled,
      };

      if (isEditing && appointment) {
        await apiFetch(`/api/appointments/${appointment.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch("/api/appointments", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }

      await onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving appointment:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (!appointment) {
      setDoctorName("");
      setSpecialty("");
      setLocation("");
      setDateStr("");
      setNotes("");
      setCopayAmount("");
      setReminderEnabled(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-md rounded-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cita Médica" : "Nueva Cita Médica"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Doctor name */}
          <div className="space-y-2">
            <Label htmlFor="apt-doctor">Nombre del doctor</Label>
            <Input
              id="apt-doctor"
              placeholder="Ej: Dr. García"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label>Especialidad</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleccionar especialidad" />
              </SelectTrigger>
              <SelectContent>
                {specialtyOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="apt-location">Ubicación</Label>
            <Input
              id="apt-location"
              placeholder="Ej: Clínica del Valle, Consultorio 302"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Date and time */}
          <div className="space-y-2">
            <Label htmlFor="apt-date">Fecha y hora</Label>
            <Input
              id="apt-date"
              type="datetime-local"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="apt-notes">Notas</Label>
            <Textarea
              id="apt-notes"
              placeholder="Notas adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apt-copay">Copago / gasto asociado</Label>
            <Input
              id="apt-copay"
              type="number"
              min="0"
              step="1"
              placeholder="Ej: 12000"
              value={copayAmount}
              onChange={(e) => setCopayAmount(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-gray-500">
              Al completar la cita podrás confirmar si realmente hubo copago, editar el valor y escoger cuenta o tarjeta.
            </p>
          </div>

          {/* Reminder */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <Label className="text-sm">Recordatorio</Label>
              <p className="text-xs text-gray-400">
                Notificación antes de la cita
              </p>
            </div>
            <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !dateStr}
            className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-700 hover:to-pink-600"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : null}
            {isEditing ? "Guardar Cambios" : "Agendar Cita"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
