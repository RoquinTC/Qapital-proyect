"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { apiFetch, formatCurrency } from "@/lib/api";
import { Loader2, Plus } from "lucide-react";

const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

interface SavingsContributeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  goalName: string;
  onSuccess?: () => void;
}

export function SavingsContributeForm({
  open,
  onOpenChange,
  goalId,
  goalName,
  onSuccess,
}: SavingsContributeFormProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      await apiFetch(`/api/savings/${goalId}/contribute`, {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: description || null,
        }),
      });

      onSuccess?.();
      onOpenChange(false);
      setAmount("");
      setDescription("");
    } catch (error) {
      console.error("Error contributing:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="rounded-t-2xl sm:rounded-2xl">
        <SheetHeader>
          <SheetTitle>Aportar a {goalName}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Monto</Label>
            <CurrencyInput value={amount} onChange={setAmount} showPrefix placeholder="0" className="rounded-xl text-xl font-bold h-14" />
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa}
                  onClick={() => setAmount(qa.toString())}
                  className="py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {formatCurrency(qa)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input
              placeholder="Ej: Ahorro quincenal"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 h-12"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Aportar {amount ? formatCurrency(parseFloat(amount)) : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
