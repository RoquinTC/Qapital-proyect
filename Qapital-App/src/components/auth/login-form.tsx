"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Lock, LogIn, Loader2, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { startAuthentication } from "@simplewebauthn/browser";

export function LoginForm() {
  const { setAuthView } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Check if WebAuthn is available in this browser
  const webAuthnAvailable = typeof window !== "undefined" && 
    typeof PublicKeyCredential !== "undefined";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const errorMessages: Record<string, string> = {
          "CredentialsSignin": "Correo o contraseña incorrectos",
          "SessionRequired": "Debes iniciar sesión",
        };
        const msg = errorMessages[result.error] || result.error;
        toast.error(msg);
        setLoading(false);
      } else if (result?.ok) {
        toast.success("¡Sesión iniciada!");
        // Mark fresh login so AppShell skips the lock screen on reload
        try { sessionStorage.setItem("quid-just-logged-in", "true"); } catch {}
        // Use a hard redirect instead of client-side navigation.
        // In iframe/embedded contexts, the session cookie (SameSite=None; Secure)
        // needs a full page load to be properly recognized by the browser.
        // Using window.location.href forces a full page reload which ensures
        // the SessionProvider picks up the new session from /api/auth/session.
        setTimeout(() => {
          window.location.href = window.location.origin + "/";
        }, 600);
      }
    } catch {
      toast.error("Error de conexión");
      setLoading(false);
    }
  };

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    try {
      // === USERNAMELESS FLOW (preferred) ===
      // Try to authenticate without asking for email first.
      // This works if the user registered a resident/discoverable credential
      // (which we enforce with residentKey: "required" during registration).

      // Step 1: Get authentication options WITHOUT userId (allows discoverable credentials)
      const optionsRes = await fetch("/api/auth/webauthn/auth-options");
      if (!optionsRes.ok) {
        throw new Error("No se pudieron obtener las opciones de autenticación");
      }
      const options = await optionsRes.json();

      // Step 2: Call browser WebAuthn API — will show fingerprint prompt
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          // User cancelled the biometric prompt — don't show error
          setBiometricLoading(false);
          return;
        }
        throw err;
      }

      // Step 3: Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: asseResp }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.verified && verifyData.email) {
        // Success! Sign in via next-auth with the biometric bypass
        const result = await signIn("credentials", {
          email: verifyData.email,
          password: "__webauthn_bypass__",
          redirect: false,
        });

        if (result?.ok) {
          toast.success("¡Sesión iniciada con huella!");
          // Mark fresh login so AppShell skips the lock screen on reload
          try { sessionStorage.setItem("quid-just-logged-in", "true"); } catch {}
          setTimeout(() => {
            window.location.href = window.location.origin + "/";
          }, 600);
        } else {
          toast.error("Error al iniciar sesión con huella");
        }
      } else {
        toast.error("Huella no reconocida");
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);
      toast.error("No se pudo autenticar con huella. Intenta con correo y contraseña.");
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/icon-192.png"
            alt="Quid"
            className="size-20 mx-auto mb-4 rounded-2xl shadow-lg shadow-emerald-500/30"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            Quid
          </h1>
          <p className="text-sm text-gray-500 mt-1">Todo converge aqui</p>
        </div>

        <Card className="border-0 shadow-xl shadow-emerald-500/5 rounded-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
            <CardDescription>Ingresa a tu cuenta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Iniciar Sesión
                  </>
                )}
              </Button>
            </form>

            {/* Biometric Login */}
            {webAuthnAvailable && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-gray-900 px-2 text-gray-400">o</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/10 gap-2 transition-all duration-200"
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading || loading}
                >
                  {biometricLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Fingerprint className="size-4" />
                  )}
                  Ingresar con huella
                </Button>
              </>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                ¿No tienes cuenta?{" "}
                <button
                  onClick={() => setAuthView("register")}
                  className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  Regístrate
                </button>
              </p>
              <p className="text-sm text-gray-500 mt-3">
                ¿Olvidaste tu contraseña?{" "}
                <button
                  onClick={() => setAuthView("forgot-password")}
                  className="text-amber-600 font-semibold hover:text-amber-700 transition-colors"
                >
                  Recuperar
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
