"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreVertical,
  UserX,
  UserCheck,
  KeyRound,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isAdmin } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrator",
  SZEF: "Szef",
  MENEDZER: "Menedżer",
  MAGAZYNIER: "Magazynier",
  SERWISANT: "Serwisant",
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
  SZEF: "bg-amber-100 text-amber-700",
  MENEDZER: "bg-red-100 text-red-900",
  MAGAZYNIER: "bg-green-100 text-green-700",
  SERWISANT: "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktywny",
  BLOCKED: "Zablokowany",
  ARCHIVED: "Zarchiwizowany",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  BLOCKED: "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  login: string | null;
  position: string | null;
  accountStatus: string;
  lastLoginAt: string | null;
  roleAssignments: Array<{ role: { name: string } }>;
};

function ResetPasswordDialog({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      const r = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Błąd resetowania hasła.");
        return;
      }
      toast.success("Hasło zostało zresetowane. Użytkownik będzie musiał je zmienić przy następnym logowaniu.");
      setPassword("");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetuj hasło użytkownika</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>Nowe hasło tymczasowe</Label>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min. 8 znaków, wielka litera, cyfra, znak specjalny"
          />
          <p className="text-xs text-gray-500">
            Przekaż hasło użytkownikowi. Będzie musiał je zmienić przy logowaniu.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={handleReset} disabled={loading || password.length < 8}>
            {loading ? "Resetowanie..." : "Resetuj hasło"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [confirmBlock, setConfirmBlock] = useState<User | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<User | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", q, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const r = await fetch(`/api/users?${params}`);
      return r.json();
    },
  });

  const users: User[] = data?.data ?? [];

  const blockMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "block" | "unblock" }) => {
      const r = await fetch(`/api/users/${id}/${action}`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(action === "block" ? "Konto zablokowane." : "Konto odblokowane.");
      setConfirmBlock(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Konto zarchiwizowane.");
      setConfirmArchive(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin(session?.user)) {
    return (
      <div className="p-6 text-center text-gray-500">
        Brak dostępu do tej sekcji.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Użytkownicy</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} użytkowników
          </p>
        </div>
        <Button onClick={() => router.push("/settings/users/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Dodaj użytkownika
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Szukaj..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2 bg-white"
        >
          <option value="ALL">Wszystkie statusy</option>
          <option value="ACTIVE">Aktywni</option>
          <option value="BLOCKED">Zablokowani</option>
          <option value="ARCHIVED">Zarchiwizowani</option>
        </select>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Brak użytkowników spełniających kryteria.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const roles = user.roleAssignments?.map((ra) => ra.role.name) ?? [];
            return (
              <div
                key={user.id}
                className="bg-white rounded-xl border p-4 flex items-center gap-3 hover:border-gray-300 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-900 font-semibold text-sm shrink-0">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[user.accountStatus] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {STATUS_LABELS[user.accountStatus] ?? user.accountStatus}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {user.email ?? user.login ?? "—"}
                    {user.position && ` · ${user.position}`}
                  </p>
                </div>
                <div className="hidden md:flex gap-1 flex-wrap justify-end max-w-48">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
                <p className="hidden lg:block text-xs text-gray-400 w-28 text-right shrink-0">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString("pl-PL")
                    : "Nie logował się"}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/settings/users/${user.id}`)}
                    >
                      Edytuj
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.accountStatus === "ACTIVE" ? (
                      <DropdownMenuItem
                        className="text-orange-600"
                        onClick={() => setConfirmBlock(user)}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Zablokuj
                      </DropdownMenuItem>
                    ) : user.accountStatus === "BLOCKED" ? (
                      <DropdownMenuItem
                        className="text-green-600"
                        onClick={() =>
                          blockMutation.mutate({ id: user.id, action: "unblock" })
                        }
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Odblokuj
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => setResetPasswordUserId(user.id)}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Resetuj hasło
                    </DropdownMenuItem>
                    {user.accountStatus !== "ARCHIVED" &&
                      !roles.includes("SUPERADMIN") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setConfirmArchive(user)}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archiwizuj
                          </DropdownMenuItem>
                        </>
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Block confirmation */}
      <AlertDialog
        open={!!confirmBlock}
        onOpenChange={() => setConfirmBlock(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zablokuj konto</AlertDialogTitle>
            <AlertDialogDescription>
              Konto użytkownika{" "}
              <strong>
                {confirmBlock?.firstName} {confirmBlock?.lastName}
              </strong>{" "}
              zostanie zablokowane. Użytkownik nie będzie mógł się zalogować.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() =>
                confirmBlock &&
                blockMutation.mutate({ id: confirmBlock.id, action: "block" })
              }
            >
              Zablokuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog
        open={!!confirmArchive}
        onOpenChange={() => setConfirmArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiwizuj konto</AlertDialogTitle>
            <AlertDialogDescription>
              Konto użytkownika{" "}
              <strong>
                {confirmArchive?.firstName} {confirmArchive?.lastName}
              </strong>{" "}
              zostanie zarchiwizowane. Dane zostaną zachowane, ale konto będzie
              nieaktywne.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                confirmArchive && archiveMutation.mutate(confirmArchive.id)
              }
            >
              Archiwizuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password dialog */}
      {resetPasswordUserId && (
        <ResetPasswordDialog
          userId={resetPasswordUserId}
          open={!!resetPasswordUserId}
          onClose={() => setResetPasswordUserId(null)}
        />
      )}
    </div>
  );
}
