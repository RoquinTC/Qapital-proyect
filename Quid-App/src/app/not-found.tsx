"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-8xl font-black tracking-tight text-emerald-600 dark:text-emerald-500 animate-pulse">
          404
        </h1>
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
          Página no encontrada
        </h2>
        <p className="max-w-md text-neutral-500 dark:text-neutral-400">
          Lo sentimos, el recurso que buscas no está disponible o ha sido movido.
        </p>
      </div>
      
      <Link
        href="/"
        className="mt-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-6 py-3 font-semibold shadow-md transition-all duration-200"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
