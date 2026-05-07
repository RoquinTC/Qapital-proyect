"use client";

import { formatCurrency } from "@/lib/api";
import { Users, TrendingUp, Banknote, Wallet, Smartphone, CircleDollarSign, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    color: string;
    icon?: string | null;
    balance: number;
    isHighYield: boolean;
    yieldPercentage?: number | null;
    isShared: boolean;
    subAccounts?: Array<{
      id: string;
      name: string;
      balance: number;
    }>;
    sharedUsers?: Array<{
      id: string;
      user: { name: string; email: string };
    }>;
  };
  onClick?: () => void;
}

const typeIcons: Record<string, typeof Wallet> = {
  checking: Banknote,
  savings: Wallet,
  cash: CircleDollarSign,
  digital_wallet: Smartphone,
  credit_card: CreditCard,
  other: Wallet,
};

const typeLabels: Record<string, string> = {
  checking: "Corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  digital_wallet: "Billetera Digital",
  credit_card: "Tarjeta de Crédito",
  other: "Otra",
};

export function AccountCard({ account, onClick }: AccountCardProps) {
  const Icon = typeIcons[account.type] || Wallet;
  const typeLabel = typeLabels[account.type] || "Cuenta";

  // All accounts render as a card visual with the chosen color
  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left"
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden p-5 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${account.color}, ${account.color}dd, ${account.color}aa)`,
        }}
      >
        {/* Decorative circle pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />

        {/* Top row: Type icon + badges */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Icon className="size-4.5 text-white" />
            </div>
            <span className="text-[10px] text-white/70 uppercase tracking-wider font-medium">
              {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {account.isHighYield && (
              <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                <TrendingUp className="size-3 text-white/90" />
                <span className="text-[9px] font-medium text-white/90">
                  {account.yieldPercentage}%
                </span>
              </div>
            )}
            {account.isShared && (
              <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                <Users className="size-3 text-white/90" />
                <span className="text-[9px] text-white/90">Compartida</span>
              </div>
            )}
          </div>
        </div>

        {/* Account name */}
        <h3 className="text-sm font-semibold text-white/90 truncate mb-1">
          {account.name}
        </h3>

        {/* Balance */}
        <div className="flex items-end justify-between mt-2 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="block text-[9px] text-white/50 uppercase tracking-wider">
              Balance
            </span>
            <p className="text-2xl font-bold text-white tracking-tight break-all">
              {formatCurrency(account.balance)}
            </p>
          </div>

          {/* Sub-accounts count */}
          {account.subAccounts && account.subAccounts.length > 0 && (
            <div className="text-right">
              <span className="block text-[9px] text-white/50 uppercase tracking-wider">
                Bolsillos
              </span>
              <span className="text-sm font-semibold text-white/80">
                {account.subAccounts.length}
              </span>
            </div>
          )}
        </div>

        {/* Bottom decorative line */}
        <div className="mt-4 h-[2px] rounded-full bg-white/10" />
      </div>
    </motion.button>
  );
}
