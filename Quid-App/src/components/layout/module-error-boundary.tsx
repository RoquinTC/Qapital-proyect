"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
}

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  state: ModuleErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModuleErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ModuleErrorBoundary] Module crashed:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Esta vista tuvo un problema
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Tus datos locales siguen disponibles. Intenta recargar esta vista.
          </p>
          <Button
            className="mt-4 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => this.setState({ hasError: false })}
          >
            <RotateCcw className="size-4" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }
}
