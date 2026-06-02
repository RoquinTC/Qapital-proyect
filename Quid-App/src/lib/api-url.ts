export function resolveApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const capacitor = (window as any).Capacitor;
    const isCapacitor =
      origin.startsWith("capacitor://") ||
      origin.startsWith("file://") ||
      capacitor?.isNativePlatform?.() === true;

    if (isCapacitor) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app";
      return `${backendUrl}${url}`;
    }
  }

  return url;
}

export function apiRequest(url: string, options?: RequestInit): Promise<Response> {
  const resolvedUrl = resolveApiUrl(url);
  const isCrossOrigin = resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://");

  return fetch(resolvedUrl, {
    ...options,
    credentials: isCrossOrigin ? "include" : options?.credentials,
  });
}
