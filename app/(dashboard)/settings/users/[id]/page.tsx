"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, KeyRound, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { isSuperAdmin } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Administrator",
  ADMIN: "Administrator",
  SZEF: "Szef",
  MENEDZER: "Menedżer",
  MAGAZYNIER: "Magazynier",
  SERWISANT: "Serwisant",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktywny",
  BLOCKED: "Zablokowany",
  ARCHIVED: "Zarchiwizowany",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-green-700 bg-green-100",
  BLOCKED: "text-orange-700 bg-orange-100",
  ARCHIVED: "text-gray-500 bg-gray-100",
};

type UserDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  login: string | null;
  phone: string | null;
  position: string | null;
  adminNote: string | null;
  accountStatus: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roleAssignments: Array<{ role: { id: string; name: string; displayName: string } }>;
  permissionOverrides: Array<{
    id: string;
    permissionId: string;
    effect: string;
    reason: string | null;
    permission: { module: string; action: string; displayName: string };
  }>;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  phone: string;
  position: string;
  adminNote: string;
};

function DataTab({ user }: { user: UserDetail }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<ProfileForm>();

  useEffect(() => {
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? "",
      login: user.login ?? "",
      phone: user.phone ?? "",
      position: user.position ?? "",
      adminNote: user.adminNote ?? "",
    });
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const r = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      toast.success("Dane użytkownika zostały zapisane.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Imię</Label>
          <Input {...register("firstName", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Nazwisko</Label>
          <Input {...register("lastName", { required: true })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" {...register("email")} />
        </div>
        <div className="space-y-1.5">
          <Label>Login</Label>
          <Input {...register("login")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input {...register("phone")} />
        </div>
        <div className="space-y-1.5">
          <Label>Stanowisko</Label>
          <Input {...register("position")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notatka administracyjna</Label>
        <Textarea {...register("adminNote")} rows={3} />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {mutation.isPending ? "Zapisywanie..." : "Zapisz dane"}
      </Button>
    </form>
  );
}

function RolesTab({ user }: { user: UserDetail }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isSuper = isSuperAdmin(session?.user);

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const r = await fetch("/api/roles");
      return r.json();
    },
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const r = await fetch("/api/permissions");
      return r.json();
    },
  });

  const allRoles: Array<{ id: string; name: string; displayName: string }> =
    (rolesData?.data ?? []).filter((r: { name: string }) => {
      if (!isSuper && ["ADMIN", "SUPERADMIN"].includes(r.name)) return false;
      return true;
    });

  const currentRoleIds = user.roleAssignments.map((ra) => ra.role.id);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(currentRoleIds);

  // Overrides: permissionId -> "ALLOW" | "DENY" | undefined (default)
  const [overrides, setOverrides] = useState<Record<string, string | undefined>>(() => {
    const map: Record<string, string | undefined> = {};
    for (const o of user.permissionOverrides) {
      map[o.permissionId] = o.effect;
    }
    return map;
  });

  const rolesMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/users/${user.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoleIds }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      toast.success("Role zostały zaktualizowane.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const permsMutation = useMutation({
    mutationFn: async () => {
      const permsFlat: Array<{ id: string; module: string; action: string }> = [];
      const grouped = permissionsData?.data ?? {};
      for (const module of Object.keys(grouped)) {
        for (const p of grouped[module]) {
          permsFlat.push(p);
        }
      }

      const overrideList = permsFlat
        .filter((p) => overrides[p.id] !== undefined)
        .map((p) => ({ permissionId: p.id, effect: overrides[p.id]! }));

      const r = await fetch(`/api/users/${user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: overrideList }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      toast.success("Wyjątki uprawnień zostały zapisane.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = permissionsData?.data ?? {};
  const MODULE_LABELS: Record<string, string> = {
    orders: "Zlecenia",
    clients: "Klienci",
    vehicles: "Pojazdy",
    stock: "Magazyn",
    analytics: "Analityki",
    templates: "Szablony",
    protocols: "Protokoły",
    calendar: "Kalendarz",
    users: "Użytkownicy",
    settings: "Ustawienia",
  };

  return (
    <div className="space-y-6">
      {/* Roles */}
      <div>
        <h3 className="font-medium text-gray-800 mb-3">Przypisane role</h3>
        <div className="space-y-2 mb-3">
          {allRoles.map((role) => (
            <label key={role.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={selectedRoleIds.includes(role.id)}
                onChange={(e) => {
                  setSelectedRoleIds((prev) =>
                    e.target.checked
                      ? [...prev, role.id]
                      : prev.filter((id) => id !== role.id)
                  );
                }}
              />
              <span className="text-sm">
                {ROLE_LABELS[role.name] ?? role.displayName}
              </span>
            </label>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => rolesMutation.mutate()}
          disabled={rolesMutation.isPending}
        >
          {rolesMutation.isPending ? "Zapisywanie..." : "Zapisz role"}
        </Button>
      </div>

      {/* Permission overrides */}
      <div>
        <h3 className="font-medium text-gray-800 mb-1">Wyjątki uprawnień</h3>
        <p className="text-xs text-gray-500 mb-3">
          Wyjątki mają wyższy priorytet niż uprawnienia z ról. ZEZWÓL = dostęp niezależnie od roli. ODMÓW = brak dostępu niezależnie od roli.
        </p>
        <div className="space-y-4">
          {Object.keys(grouped).map((module) => (
            <div key={module}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {MODULE_LABELS[module] ?? module}
              </p>
              <div className="space-y-1.5">
                {grouped[module].map(
                  (p: { id: string; displayName: string; action: string }) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-gray-700">{p.displayName}</span>
                      <select
                        value={overrides[p.id] ?? "DEFAULT"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOverrides((prev) => ({
                            ...prev,
                            [p.id]: val === "DEFAULT" ? undefined : val,
                          }));
                        }}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        <option value="DEFAULT">Domyślnie (z roli)</option>
                        <option value="ALLOW">Zawsze ZEZWÓL</option>
                        <option value="DENY">Zawsze ODMÓW</option>
                      </select>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-4"
          onClick={() => permsMutation.mutate()}
          disabled={permsMutation.isPending}
        >
          {permsMutation.isPending ? "Zapisywanie..." : "Zapisz wyjątki uprawnień"}
        </Button>
      </div>
    </div>
  );
}

function SecurityTab({ user }: { user: UserDetail }) {
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const blockMutation = useMutation({
    mutationFn: async (action: "block" | "unblock") => {
      const r = await fetch(`/api/users/${user.id}/${action}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      toast.success(action === "block" ? "Konto zablokowane." : "Konto odblokowane.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast.success("Hasło zresetowane. Użytkownik musi je zmienić przy logowaniu.");
      setResetOpen(false);
      setNewPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div>
          <p className="font-medium text-sm">Status konta</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_COLORS[user.accountStatus] ?? "bg-gray-100"}`}
          >
            {STATUS_LABELS[user.accountStatus] ?? user.accountStatus}
          </span>
        </div>
        {user.accountStatus === "ACTIVE" && !user.roleAssignments.some((ra) => ra.role.name === "SUPERADMIN") && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-orange-600 border-orange-300"
            onClick={() => blockMutation.mutate("block")}
            disabled={blockMutation.isPending}
          >
            <UserX className="h-4 w-4" />
            Zablokuj
          </Button>
        )}
        {user.accountStatus === "BLOCKED" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-green-600 border-green-300"
            onClick={() => blockMutation.mutate("unblock")}
            disabled={blockMutation.isPending}
          >
            <UserCheck className="h-4 w-4" />
            Odblokuj
          </Button>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Nieudane próby logowania:</span>
          <span className="font-medium">{user.failedLoginAttempts}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Blokada tymczasowa do:</span>
          <span className="font-medium">
            {user.lockedUntil
              ? new Date(user.lockedUntil).toLocaleString("pl-PL")
              : "Brak"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Ostatnie logowanie:</span>
          <span className="font-medium">
            {user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString("pl-PL")
              : "Nigdy"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Wymuszenie zmiany hasła:</span>
          <span className="font-medium">{user.mustChangePassword ? "Tak" : "Nie"}</span>
        </div>
      </div>

      <div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setResetOpen(true)}
        >
          <KeyRound className="h-4 w-4" />
          Resetuj hasło
        </Button>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetuj hasło</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Nowe hasło tymczasowe</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="min. 8 znaków, wielka litera, cyfra, znak specjalny"
            />
            <p className="text-xs text-gray-500">
              Przekaż hasło użytkownikowi — będzie musiał je zmienić przy logowaniu.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || newPassword.length < 8}
            >
              {resetMutation.isPending ? "Resetowanie..." : "Resetuj hasło"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const r = await fetch(`/api/users/${id}`);
      return r.json();
    },
  });

  const user: UserDetail | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        Nie znaleziono użytkownika.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500">
            {user.email ?? user.login ?? "Brak danych kontaktowych"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="data">
        <TabsList className="mb-6">
          <TabsTrigger value="data">Dane</TabsTrigger>
          <TabsTrigger value="roles">Role i uprawnienia</TabsTrigger>
          <TabsTrigger value="security">Bezpieczeństwo</TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <div className="bg-white rounded-xl border p-5">
            <DataTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="bg-white rounded-xl border p-5">
            <RolesTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="bg-white rounded-xl border p-5">
            <SecurityTab user={user} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
