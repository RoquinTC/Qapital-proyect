"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";

interface ExportMenuProps {
  type: "transactions" | "balances" | "debts";
  filters?: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    category?: string;
    type?: string;
  };
  hasActiveFilters?: boolean;
  /** Use "onGradient" for dark/gradient backgrounds where white icon is needed */
  variant?: "default" | "onGradient";
  className?: string;
}

export function ExportMenu({ type, filters, hasActiveFilters, variant = "default", className }: ExportMenuProps) {
  const [exporting, setExporting] = useState(false);

  const iconColor = variant === "onGradient" ? "text-white/70" : "text-gray-500";
  const hoverClass = variant === "onGradient" ? "hover:bg-white/10" : "hover:bg-gray-100 dark:hover:bg-gray-700";

  const handleExport = async (useFilters: boolean) => {
    setExporting(true);
    try {
      let url = `/api/finance/export/${type}`;
      if (type === "transactions" && useFilters && filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.accountId && filters.accountId !== "all")
          params.set("accountId", filters.accountId);
        if (filters.category && filters.category !== "all")
          params.set("category", filters.category);
        if (filters.type && filters.type !== "all")
          params.set("type", filters.type);
        const qs = params.toString();
        if (qs) url += `?${qs}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `qapital-${type}-${new Date().toISOString().split("T")[0]}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (match) filename = match[1].replace(/['"]/g, "");
      }
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`size-8 rounded-lg ${hoverClass} ${className || ""}`}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className={`size-4 animate-spin ${iconColor}`} />
          ) : (
            <Download className={`size-4 ${iconColor}`} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {type === "transactions" && hasActiveFilters ? (
          <>
            <DropdownMenuItem onClick={() => handleExport(true)}>
              <Download className="size-3.5 mr-2" />
              Lo que estoy viendo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport(false)}>
              <Download className="size-3.5 mr-2" />
              Todo el historial
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => handleExport(false)}>
            <Download className="size-3.5 mr-2" />
            Exportar a Excel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
