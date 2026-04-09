"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { toast } from "sonner";
import { Building2, Users, Save } from "lucide-react";
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
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roles: Array<{ role: string }>;
}

function CompanyTab() {
  const queryClient = useQueryClient();
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

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4 max-w-lg">
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
        {mutation.isPending ? "Zapisywanie..." : "Zapisz"}
      </Button>
    </form>
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

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Administrator",
    SERWISANT: "Serwisant",
    MAGAZYN: "Magazyn",
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
            <div key={user.id} className="bg-white rounded-lg border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {user.roles.map((r) => (
                  <span key={r.role} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[r.role] ?? r.role}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
      </Tabs>
    </div>
  );
}
