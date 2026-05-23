"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdminCounts = {
  accounts: number;
  transactions: number;
  budgets: number;
  debts: number;
  recurringPayments: number;
  savingsGoals: number;
  cdts: number;
  vehicles: number;
  fuelLogs: number;
  maintenanceRecords: number;
  vehicleReminders: number;
  medications: number;
  appointments: number;
  pantryItems: number;
  shoppingLists: number;
  notifications: number;
  backups: number;
  total: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  telegramId: string | null;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  counts: AdminCounts;
};

type OrphanTable = {
  table: string;
  count: number;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

function compactCount(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orphans, setOrphans] = useState<OrphanTable[]>([]);
  const [orphanTotal, setOrphanTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const data = await apiFetch<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadOrphans = useCallback(async () => {
    setLoadingOrphans(true);
    setError(null);
    try {
      const data = await apiFetch<{ tables: OrphanTable[]; total: number }>("/api/admin/orphans");
      setOrphans(data.tables);
      setOrphanTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al auditar registros");
    } finally {
      setLoadingOrphans(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadOrphans();
  }, [loadOrphans, loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      [user.name, user.email, user.telegramId || ""].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [query, users]);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      setMessage(`Usuario ${userToDelete.email} eliminado correctamente.`);
      setUserToDelete(null);
      setConfirmEmail("");
      await Promise.all([loadUsers(), loadOrphans()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuario");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleCleanOrphans = async () => {
    setCleaningOrphans(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{ totalDeleted: number }>("/api/admin/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "LIMPIAR" }),
      });
      setMessage(`Limpieza completada: ${data.totalDeleted} registros eliminados.`);
      await loadOrphans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar registros");
    } finally {
      setCleaningOrphans(false);
    }
  };

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-900/10 dark:text-red-300">
          {error}
        </div>
      )}

      <Card className="rounded-xl border border-gray-100 shadow-none dark:border-gray-700/50">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
                <ShieldCheck className="size-4 text-white dark:text-slate-900" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Usuarios y datos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Panel operativo para revisar y eliminar usuarios de prueba.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 rounded-xl gap-2" onClick={loadUsers} disabled={loadingUsers}>
              {loadingUsers ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Actualizar
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, correo o Telegram"
              className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            {loadingUsers && users.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 p-6 text-xs text-gray-500 dark:bg-gray-800/50">
                <Loader2 className="size-4 animate-spin" />
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center text-xs text-gray-500 dark:bg-gray-800/50">
                No hay usuarios que coincidan con la búsqueda.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-700/50 dark:bg-gray-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                        <Badge className="h-5 rounded-md bg-gray-100 px-2 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {user.onboardingCompleted ? "Activo" : "Onboarding"}
                        </Badge>
                        {user.telegramId && (
                          <Badge className="h-5 rounded-md bg-blue-100 px-2 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Telegram
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-500">{user.email}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Creado {dateLabel(user.createdAt)} · Actualizado {dateLabel(user.updatedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                      onClick={() => {
                        setUserToDelete(user);
                        setConfirmEmail("");
                      }}
                      aria-label={`Eliminar usuario ${user.email}`}
                    >
                      <UserX className="size-3.5" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="Total" value={user.counts.total} />
                    <Metric label="Finanzas" value={user.counts.accounts + user.counts.transactions + user.counts.debts + user.counts.savingsGoals + user.counts.cdts} />
                    <Metric label="Transporte" value={user.counts.vehicles + user.counts.fuelLogs + user.counts.maintenanceRecords + user.counts.vehicleReminders} />
                    <Metric label="Salud/Despensa" value={user.counts.medications + user.counts.appointments + user.counts.pantryItems + user.counts.shoppingLists} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-amber-100 bg-amber-50/40 shadow-none dark:border-amber-900/40 dark:bg-amber-900/10">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Database className="size-4 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Auditoría de huérfanos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verifica registros con userId sin usuario padre después de migraciones.
                </p>
              </div>
            </div>
            <Badge className="rounded-md bg-white text-amber-700 dark:bg-gray-900 dark:text-amber-300">
              {compactCount(orphanTotal)}
            </Badge>
          </div>

          {orphans.some((item) => item.count > 0) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {orphans.filter((item) => item.count > 0).map((item) => (
                <Metric key={item.table} label={item.table} value={item.count} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-8 flex-1 rounded-xl gap-2 text-xs" onClick={loadOrphans} disabled={loadingOrphans}>
              {loadingOrphans ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Auditar
            </Button>
            <Button
              className="h-8 flex-1 rounded-xl gap-2 bg-amber-600 text-xs hover:bg-amber-700"
              onClick={handleCleanOrphans}
              disabled={cleaningOrphans || orphanTotal === 0}
            >
              {cleaningOrphans ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Limpiar detectados
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-center">Eliminar usuario completo</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esta acción elimina usuario, finanzas, transporte, salud, despensa, backups, notificaciones y credenciales.
              Escribe el correo para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={userToDelete?.email}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-xl" disabled={deletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700"
              onClick={handleDeleteUser}
              disabled={deletingUser || confirmEmail.trim().toLowerCase() !== userToDelete?.email.toLowerCase()}
            >
              {deletingUser ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{compactCount(value)}</p>
    </div>
  );
}
