const MOBILE_TOKEN_KEY = "quid-mobile-session-token";
const NATIVE_FETCH_BRIDGE_KEY = "__quidNativeFetchBridgeInstalled";

export function isNativeApiRuntime(): boolean {
  if (typeof window === "undefined") return false;

  const origin = window.location.origin;
  const capacitor = (window as any).Capacitor;
  return (
    origin.startsWith("capacitor://") ||
    origin.startsWith("file://") ||
    capacitor?.isNativePlatform?.() === true
  );
}

export function getMobileSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MOBILE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setMobileSessionToken(token: string): void {
  try {
    window.localStorage.setItem(MOBILE_TOKEN_KEY, token);
  } catch {}
}

export function clearMobileSessionToken(): void {
  try {
    window.localStorage.removeItem(MOBILE_TOKEN_KEY);
  } catch {}
}

export function resolveApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (typeof window !== "undefined") {
    if (isNativeApiRuntime()) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app";
      return `${backendUrl}${url}`;
    }
  }

  return url;
}

export function apiRequest(url: string, options?: RequestInit): Promise<Response> {
  const resolvedUrl = resolveApiUrl(url);
  const isCrossOrigin = resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://");
  const mobileToken = isNativeApiRuntime() ? getMobileSessionToken() : null;

  return fetch(resolvedUrl, {
    ...options,
    headers: {
      ...(mobileToken ? { Authorization: `Bearer ${mobileToken}` } : {}),
      ...options?.headers,
    },
    credentials: isCrossOrigin ? "include" : options?.credentials,
  });
}

export function installNativeApiFetchBridge(): void {
  if (!isNativeApiRuntime() || (window as any)[NATIVE_FETCH_BRIDGE_KEY]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const resolvedUrl = url.startsWith("/") ? resolveApiUrl(url) : url;
    const mobileToken = getMobileSessionToken();
    const isBackendRequest = resolvedUrl.startsWith(
      process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app"
    );

    return originalFetch(resolvedUrl, {
      ...options,
      headers: {
        ...(mobileToken && isBackendRequest ? { Authorization: `Bearer ${mobileToken}` } : {}),
        ...options?.headers,
      },
      credentials: isBackendRequest ? "include" : options?.credentials,
    });
  };
  (window as any)[NATIVE_FETCH_BRIDGE_KEY] = true;
}
