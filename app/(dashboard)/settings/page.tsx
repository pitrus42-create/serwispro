"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Building2, Users, Save, Shield, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";

interface CompanySettings {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  nip: string | null;
  logoUrl: string | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  login: string | null;
  phone: string | null;
  accountStatus: string;
  roleAssignments: Array<{ role: { name: string; displayName: string } }>;
}

function CompanyTab() {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings/company");
      return r.json();
    },
  });

  const settings: CompanySettings = data?.data ?? {};

  const { register, handleSubmit, reset } = useForm<CompanySettings>();

  useEffect(() => {
    if (settings.name !== undefined) reset(settings);
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CompanySettings) => {
      const r = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error("Błąd zapisu");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Dane firmy zostały zapisane");
    },
    onError: () => toast.error("Błąd zapisu danych"),
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await fetch("/api/settings/company/logo", { method: "POST", body: fd });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Błąd uploadu");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Logo zostało zaktualizowane");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-lg">
      {/* Logo section */}
      <div className="space-y-3">
        <Label>Logo firmy</Label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={logoMutation.isPending}
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {logoMutation.isPending ? "Przesyłanie..." : "Zmień logo"}
            </Button>
            <p className="text-xs text-gray-400">PNG, JPG lub SVG, max 2 MB</p>
            <p className="text-xs text-gray-400">Pojawi się na protokołach serwisowych</p>
          </div>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) logoMutation.mutate(file);
            e.target.value = "";
          }}
        />
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nazwa firmy</Label>
          <Input id="name" {...register("name")} placeholder="SerwisPro Sp. z o.o." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Adres</Label>
          <Input id="address" {...register("address")} placeholder="ul. Przykładowa 1, 00-001 Warszawa" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register("phone")} placeholder="+48 22 123 45 67" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nip">NIP</Label>
            <Input id="nip" {...register("nip")} placeholder="1234567890" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} placeholder="biuro@firma.pl" />
        </div>
        <Button type="submit" disabled={mutation.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {mutation.isPending ? "Zapisywanie..." : "Zapisz dane firmy"}
        </Button>
      </form>
    </div>
  );
}

function UsersTab() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      return r.json();
    },
  });

  const users: User[] = data?.data ?? [];

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    BLOCKED: "bg-red-100 text-red-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
  };
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Aktywny",
    BLOCKED: "Zablokowany",
    ARCHIVED: "Zarchiwizowany",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} użytkowników</p>
        <Button size="sm" onClick={() => router.push("/settings/users/new")}>
          Dodaj użytkownika
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
              onClick={() => router.push(`/settings/users/${user.id}`)}
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-sm text-gray-500 truncate">{user.email ?? user.login ?? "—"}</p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end items-center">
                {user.roleAssignments?.map((ra) => (
                  <span key={ra.role.name} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {ra.role.displayName}
                  </span>
                ))}
                <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${STATUS_COLORS[user.accountStatus] ?? "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABELS[user.accountStatus] ?? user.accountStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-right">
        <Button variant="outline" size="sm" onClick={() => router.push("/settings/users")}>
          Zarządzaj użytkownikami →
        </Button>
      </div>
    </div>
  );
}

function RolesTab() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const r = await fetch("/api/roles");
      return r.json();
    },
  });

  const roles: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    isSystem: boolean;
    _count: { userRoleAssignments: number; rolePermissions: number };
  }> = data?.data ?? [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{roles.length} ról w systemie</p>
        <Button size="sm" onClick={() => router.push("/settings/roles/new")}>
          Nowa rola
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white rounded-lg border p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
              onClick={() => router.push(`/settings/roles/${role.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{role.displayName}</p>
                  <span className="text-xs text-gray-400 font-mono">{role.name}</span>
                  {role.isSystem && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Systemowa</span>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-500 truncate">{role.description}</p>
                )}
              </div>
              <div className="text-xs text-gray-400 shrink-0 text-right">
                <p>{role._count.userRoleAssignments} użytk.</p>
                <p>{role._count.rolePermissions} uprawn.</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-right">
        <Button variant="outline" size="sm" onClick={() => router.push("/settings/roles")}>
          Zarządzaj rolami →
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia</h1>

      <Tabs defaultValue="company">
        <TabsList className="mb-6">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Firma
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Użytkownicy
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Role
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Dane firmy</h2>
            <CompanyTab />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Zarządzanie użytkownikami</h2>
            <UsersTab />
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
