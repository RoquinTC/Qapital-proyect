import { Capacitor, registerPlugin } from "@capacitor/core";

interface QuidBiometricPlugin {
  isAvailable(): Promise<{ available: boolean; status: number }>;
  authenticate(): Promise<{ authenticated: boolean }>;
}

const QuidBiometric = registerPlugin<QuidBiometricPlugin>("QuidBiometric");

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function isNativeBiometricAvailable(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  const result = await QuidBiometric.isAvailable();
  return result.available;
}

export async function authenticateWithNativeBiometric(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  const result = await QuidBiometric.authenticate();
  return result.authenticated;
}
