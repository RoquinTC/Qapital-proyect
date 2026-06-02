"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeAndroid } from "@/lib/native/biometric";

function openQuidRoute(route?: string) {
  if (!route || typeof window === "undefined") return;
  window.location.href = route;
}

export function NativeDeviceBridge() {
  useEffect(() => {
    if (!isNativeAndroid()) return;

    const listeners = [
      LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        openQuidRoute(notification.extra?.route);
      }),
      App.addListener("appUrlOpen", ({ url }) => {
        try {
          const parsed = new URL(url);
          openQuidRoute(`${parsed.pathname}${parsed.search}${parsed.hash}`);
        } catch {
          // Ignore malformed external links.
        }
      }),
    ];

    return () => {
      listeners.forEach((listener) => {
        listener.then((handle) => handle.remove());
      });
    };
  }, []);

  return null;
}
