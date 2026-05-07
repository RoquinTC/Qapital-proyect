"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TrendingUp, Receipt, Lightbulb } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  category?: string | null;
  date: string;
}

interface BudgetDetailProps {
  budgetId?: string;
}

export function BudgetDetail({ budgetId }: BudgetDetailProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Budget detail is shown inline when tapping a budget category
  // For now, just show the related transactions
  return (
    <div className="p-4 space-y-4 pb-24">
      <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="size-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Consejos para tu presupuesto
            </span>
          </div>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li>• Registra todos tus gastos diarios</li>
            <li>• Revisa tu presupuesto cada semana</li>
            <li>• Usa la regla 50/30/20 para distribuir ingresos</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
