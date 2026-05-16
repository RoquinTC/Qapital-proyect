"use client";

import { useEffect, useCallback, useRef } from "react";
import { getColombiaTodayString } from "@/lib/api";

interface MedicationReminder {
  id: string;
  name: string;
  dosage: string;
  reminderTimes: string | null;
  isActive: boolean;
  reminderEnabled: boolean;
}

interface AppointmentReminder {
  id: string;
  doctorName: string | null;
  specialty: string | null;
  date: string;
  status: string;
  reminderEnabled: boolean;
}

// Simple audio tone for medication reminders
function playReminderTone() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;

    oscillator.start();

    // Play a gentle two-tone pattern
    setTimeout(() => {
      oscillator.frequency.value = 1000;
    }, 200);
    setTimeout(() => {
      oscillator.frequency.value = 800;
    }, 400);
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 600);
  } catch {
    // Audio not available
  }
}

export function useReminders() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const checkMedications = useCallback(async () => {
    try {
      const res = await fetch("/api/medications");
      if (!res.ok) return;
      const medications: MedicationReminder[] = await res.json();

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const med of medications) {
        if (!med.isActive || !med.reminderEnabled || !med.reminderTimes) continue;

        try {
          const times: string[] = JSON.parse(med.reminderTimes);
          for (const time of times) {
            const notifKey = `${med.id}-${time}-${getColombiaTodayString()}`;
            if (time === currentTime && !notifiedRef.current.has(notifKey)) {
              notifiedRef.current.add(notifKey);
              playReminderTone();

              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("💊 Hora de tu medicamento", {
                  body: `${med.name} - ${med.dosage}`,
                  icon: "/favicon.ico",
                  tag: notifKey,
                });
              }
            }
          }
        } catch {
          // Invalid reminder times format
        }
      }
    } catch {
      // Failed to fetch medications
    }
  }, []);

  const checkAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments");
      if (!res.ok) return;
      const appointments: AppointmentReminder[] = await res.json();

      const now = new Date();

      for (const apt of appointments) {
        if (apt.status !== "scheduled" || !apt.reminderEnabled) continue;

        const aptDate = new Date(apt.date);
        const diffMs = aptDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // 1 day before reminder
        const oneDayKey = `${apt.id}-1day-${getColombiaTodayString()}-${now.getHours()}`;
        if (diffHours > 23 && diffHours <= 24 && !notifiedRef.current.has(oneDayKey)) {
          notifiedRef.current.add(oneDayKey);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("📋 Cita médica mañana", {
              body: `${apt.doctorName || "Cita médica"}${apt.specialty ? ` - ${apt.specialty}` : ""}`,
              icon: "/favicon.ico",
              tag: oneDayKey,
            });
          }
        }

        // 1 hour before reminder
        const oneHourKey = `${apt.id}-1hour-${getColombiaTodayString()}-${now.getHours()}-${now.getMinutes()}`;
        if (diffHours > 0.9 && diffHours <= 1.1 && !notifiedRef.current.has(oneHourKey)) {
          notifiedRef.current.add(oneHourKey);
          playReminderTone();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("⏰ Cita médica en 1 hora", {
              body: `${apt.doctorName || "Cita médica"}${apt.specialty ? ` - ${apt.specialty}` : ""}`,
              icon: "/favicon.ico",
              tag: oneHourKey,
            });
          }
        }
      }
    } catch {
      // Failed to fetch appointments
    }
  }, []);

  useEffect(() => {
    requestPermission();

    // Check every minute
    intervalRef.current = setInterval(() => {
      checkMedications();
      checkAppointments();
    }, 60 * 1000);

    // Initial check
    checkMedications();
    checkAppointments();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [requestPermission, checkMedications, checkAppointments]);

  return { requestPermission };
}
