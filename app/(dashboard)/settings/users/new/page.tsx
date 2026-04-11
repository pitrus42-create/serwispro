"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isSuperAdmin } from "@/lib/permissions";

const PASSWORD_RULES = [
  { label: "Minimum 8 znaków", test: (p: string) => p.length >= 8 },
  { label: "Co najmniej jedna wielka litera", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Co najmniej jedna cyfra", test: (p: string) => /[0-9]/.test(p) },
  { label: "Co najmniej jeden znak specjalny", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Administrator",
  ADMIN: "Administrator",
  SZEF: "Szef",
  MENEDZER: "Menedżer",
  MAGAZYNIER: "Magazynier",
  SERWISANT: "Serwisant",
};

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  phone: string;
  position: string;
  adminNote: string;
  password: string;
};

export default function NewUserPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuper = isSuperAdmin(session?.user);

  const { register, handleSubmit, watch } = useForm<FormValues>();
  const password = watch("password", "");

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const r = await fetch("/api/roles");
      return r.json();
    },
  });

  const allRoles: Array<{ id: string; name: string; displayName: string }> =
    (rolesData?.data ?? []).filter((r: { name: string }) => {
      // Non-superadmins can't assign ADMIN or SUPERADMIN roles
      if (!isSuper && ["ADMIN", "SUPERADMIN"].includes(r.name)) return false;
      return true;
    });

  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          email: values.email || undefined,
          login: values.login || undefined,
          roleIds: selectedRoleIds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Błąd tworzenia użytkownika.");
      return data;
    },
    onSuccess: () => {
      toast.success("Konto użytkownika zostało utworzone.");
      router.push("/settings/users");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allPassed = PASSWORD_RULES.every((r) => r.test(password));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowy użytkownik</h1>

      <form
        onSubmit={handleSubmit((v) => {
          if (selectedRoleIds.length === 0) {
            toast.error("Wybierz co najmniej jedną rolę.");
            return;
          }
          mutation.mutate(v);
        })}
        className="space-y-6"
      >
        {/* Dane podstawowe */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Dane podstawowe</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Imię <span className="text-red-500">*</span>
              </Label>
              <Input {...register("firstName", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Nazwisko <span className="text-red-500">*</span>
              </Label>
              <Input {...register("lastName", { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} placeholder="jan@firma.pl" />
            </div>
            <div className="space-y-1.5">
              <Label>Login</Label>
              <Input
                {...register("login")}
                placeholder="jkowalski"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input {...register("phone")} placeholder="+48 600 100 200" />
            </div>
            <div className="space-y-1.5">
              <Label>Stanowisko</Label>
              <Input {...register("position")} placeholder="np. Serwisant senior" />
            </div>
          </div>
        </div>

        {/* Hasło tymczasowe */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Hasło tymczasowe</h2>
          <div className="bg-blue-50 text-blue-700 text-sm rounded-lg p-3">
            Użytkownik będzie musiał zmienić hasło przy pierwszym logowaniu.
          </div>
          <div className="space-y-1.5">
            <Label>
              Hasło <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              {...register("password", { required: true })}
              autoComplete="new-password"
            />
            {password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 text-xs ${passed ? "text-green-600" : "text-gray-400"}`}
                    >
                      {passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Role */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Role</h2>
          <div className="space-y-2">
            {allRoles.map((role) => (
              <label
                key={role.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
              >
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
                <div>
                  <p className="font-medium text-sm">
                    {ROLE_LABELS[role.name] ?? role.displayName}
                  </p>
                  <p className="text-xs text-gray-500">{role.name}</p>
                </div>
              </label>
            ))}
            {allRoles.length === 0 && (
              <p className="text-sm text-gray-400">
                Brak ról — uruchom seed bazy danych.
              </p>
            )}
          </div>
        </div>

        {/* Notatka admina */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Notatka administracyjna</h2>
          <Textarea
            {...register("adminNote")}
            placeholder="Wewnętrzna notatka (widoczna tylko dla administratorów)..."
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={mutation.isPending || !allPassed}
            className="flex-1"
          >
            {mutation.isPending ? "Tworzenie..." : "Utwórz konto"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Anuluj
          </Button>
        </div>
      </form>
    </div>
  );
}

// React import needed for useState
import React from "react";
