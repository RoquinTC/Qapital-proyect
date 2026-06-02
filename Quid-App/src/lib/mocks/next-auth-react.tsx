import React, { createContext, useState, useEffect } from "react";

const SessionContext = createContext<any>({ data: null, status: "loading" });

export function SessionProvider({ children }: any) {
  const sessionData = useSession();
  return (
    <SessionContext.Provider value={sessionData}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    let isMounted = true;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app";
    
    fetch(`${backendUrl}/api/auth/session`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data && Object.keys(data).length > 0 && data.user) {
          setSession(data);
          setStatus("authenticated");
        } else {
          setSession(null);
          setStatus("unauthenticated");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setStatus("unauthenticated");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { data: session, status };
}

export async function signIn(provider: string, options: any) {
  console.log("Mock signIn called for provider:", provider);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app";

  if (provider === "credentials") {
    try {
      // 1. Obtener token CSRF del backend remoto
      const csrfRes = await fetch(`${backendUrl}/api/auth/csrf`, { credentials: "include" });
      if (!csrfRes.ok) {
        return { error: "No se pudo contactar al servidor de autenticación" };
      }
      const { csrfToken } = await csrfRes.json();

      // 2. Enviar credenciales
      const res = await fetch(`${backendUrl}/api/auth/callback/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...options,
          csrfToken,
          json: "true",
        }),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        return { error: null, ok: true, status: res.status, url: data.url };
      } else {
        return { error: data.error || "Fallo de autenticación" };
      }
    } catch (err) {
      return { error: String(err) };
    }
  } else if (provider === "google") {
    // A WebView redirect ends inside the production PWA. Native Google OAuth
    // needs an Android client, deep link callback and session hand-off first.
    return { error: "GoogleNativeUnavailable" };
  }
}

export async function signOut(options?: any) {
  console.log("Mock signOut called");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://quid.roquintc.app";

  try {
    const csrfRes = await fetch(`${backendUrl}/api/auth/csrf`, { credentials: "include" });
    const { csrfToken } = await csrfRes.json();
    await fetch(`${backendUrl}/api/auth/signout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken }),
      credentials: "include",
    });
  } catch (err) {
    console.warn("Fallo al llamar signout remoto:", err);
  }

  if (options?.redirect !== false) {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  } else {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
}
