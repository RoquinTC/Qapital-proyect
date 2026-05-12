"use client";

import { useSession, signOut } from "next-auth/react";
import { useAppStore, type ModuleType } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Home,
  Wallet,
  Car,
  Heart,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { id: "dashboard" as const, label: "Inicio", icon: Home, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  { id: "finance" as const, label: "Finanzas", icon: Wallet, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/30" },
  { id: "transport" as const, label: "Transporte", icon: Car, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "health" as const, label: "Salud", icon: Heart, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30" },
  { id: "pantry" as const, label: "Despensa", icon: ShoppingCart, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
];

export function AppSidebar() {
  const { data: session } = useSession();
  const { sidebarOpen, setSidebarOpen, setActiveModule } = useAppStore();

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "Q";

  const handleNavigate = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    setSidebarOpen(false);
  };

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-[280px] p-0 rounded-r-3xl">
        {/* User Profile Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-5 pb-6 rounded-tr-3xl">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-white text-left text-lg">Menú</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-white/30">
              <AvatarImage
                src={session?.user?.image || ""}
                alt={session?.user?.name || "Usuario"}
              />
              <AvatarFallback className="bg-white/20 text-white text-sm font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {session?.user?.name || "Usuario"}
              </p>
              <p className="text-[11px] text-emerald-100 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className={`size-9 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`size-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                  {item.label}
                </span>
                <ChevronRight className="size-4 text-gray-300 dark:text-gray-600" />
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-5 my-2 border-t dark:border-gray-800" />

        {/* Settings */}
        <div className="px-3">
          <button
            onClick={() => handleNavigate("settings")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="size-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Settings className="size-4 text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
              Ajustes
            </span>
            <ChevronRight className="size-4 text-gray-300 dark:text-gray-600" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sign Out */}
        <div className="absolute bottom-6 left-0 right-0 px-6">
          <Button
            variant="ghost"
            className="w-full justify-start text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl gap-3 text-sm"
            onClick={() => {
              setSidebarOpen(false);
              signOut();
            }}
          >
            <LogOut className="size-4" />
            Cerrar Sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
