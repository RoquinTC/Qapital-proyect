import { registerPlugin } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { isNativeAndroid } from "./biometric";

interface QuidCalendarPlugin {
  saveEvent(options: NativeCalendarEvent): Promise<{ eventId: string }>;
  removeEvent(options: { eventId: string }): Promise<void>;
}

interface NativeCalendarEvent {
  eventId?: string;
  title: string;
  description?: string;
  location?: string;
  startAt: number;
  endAt?: number;
  reminderMinutes?: number;
}

interface NativeAppointmentSync {
  appointmentId: string;
  title: string;
  description?: string;
  location?: string;
  date: Date;
  reminderEnabled: boolean;
  calendarEnabled: boolean;
}

const QuidCalendar = registerPlugin<QuidCalendarPlugin>("QuidCalendar");
const CALENDAR_STORAGE_PREFIX = "quid-calendar-event:";

function notificationIdFor(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.max(1, hash & 0x7fffffff);
}

function getStoredCalendarEventId(appointmentId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(`${CALENDAR_STORAGE_PREFIX}${appointmentId}`);
}

function storeCalendarEventId(appointmentId: string, eventId: string | null) {
  if (typeof localStorage === "undefined") return;
  const key = `${CALENDAR_STORAGE_PREFIX}${appointmentId}`;
  if (eventId) localStorage.setItem(key, eventId);
  else localStorage.removeItem(key);
}

export function hasNativeCalendarEvent(appointmentId?: string): boolean {
  return !!appointmentId && !!getStoredCalendarEventId(appointmentId);
}

export async function syncNativeAppointment(options: NativeAppointmentSync): Promise<void> {
  if (!isNativeAndroid()) return;

  const notificationId = notificationIdFor(`appointment:${options.appointmentId}`);
  await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

  const notifyAt = new Date(options.date.getTime() - 24 * 60 * 60 * 1000);
  if (options.reminderEnabled && notifyAt.getTime() > Date.now()) {
    const permission = await LocalNotifications.checkPermissions();
    const display = permission.display === "granted"
      ? permission
      : await LocalNotifications.requestPermissions();

    if (display.display === "granted") {
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: "Cita médica mañana",
          body: options.title,
          schedule: { at: notifyAt, allowWhileIdle: true },
          extra: { route: "/?tab=health&healthView=appointments" },
        }],
      });
    }
  }

  const storedEventId = getStoredCalendarEventId(options.appointmentId);
  if (!options.calendarEnabled) {
    if (storedEventId) {
      await QuidCalendar.removeEvent({ eventId: storedEventId });
      storeCalendarEventId(options.appointmentId, null);
    }
    return;
  }

  const result = await QuidCalendar.saveEvent({
    eventId: storedEventId || undefined,
    title: options.title,
    description: options.description,
    location: options.location,
    startAt: options.date.getTime(),
    endAt: options.date.getTime() + 60 * 60 * 1000,
    reminderMinutes: 24 * 60,
  });
  storeCalendarEventId(options.appointmentId, result.eventId);
}

export async function removeNativeAppointmentIntegrations(appointmentId: string): Promise<void> {
  if (!isNativeAndroid()) return;
  await LocalNotifications.cancel({
    notifications: [{ id: notificationIdFor(`appointment:${appointmentId}`) }],
  });

  const eventId = getStoredCalendarEventId(appointmentId);
  if (eventId) {
    await QuidCalendar.removeEvent({ eventId });
    storeCalendarEventId(appointmentId, null);
  }
}

export async function captureNativePhoto(): Promise<string | undefined> {
  if (!isNativeAndroid()) return undefined;
  const photo = await Camera.takePhoto({
    quality: 82,
    correctOrientation: true,
  });
  return photo.uri;
}

export async function shareNativeText(title: string, text: string): Promise<void> {
  if (!isNativeAndroid()) return;
  await Share.share({ title, text, dialogTitle: title });
}

export async function getNativeNetworkStatus() {
  if (!isNativeAndroid()) return null;
  return Network.getStatus();
}
