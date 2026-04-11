"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, Lock, Settings2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

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

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function ProfileTab() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await fetch("/api/users/me");
      return r.json();
    },
  });

  const me = data?.data;
  const { register, handleSubmit, reset } = useForm<ProfileForm>();

  useEffect(() => {
    if (me) {
      reset({
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        phone: me.phone ?? "",
        position: me.position ?? "",
      });
    }
  }, [me, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const r = await fetch(`/api/users/${session?.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Dane profilu zostały zapisane.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-lg">
      {/* Readonly info */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xl">
            {me?.firstName?.[0]}{me?.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">{me?.firstName} {me?.lastName}</p>
            <p className="text-sm text-gray-500">{me?.email ?? me?.login ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(session?.user.roles ?? []).map((role: string) => (
            <span
              key={role}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
        </div>
        <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
          <span>Ostatnie logowanie:</span>
          <span>{me?.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString("pl-PL") : "—"}</span>
          <span>Konto założono:</span>
          <span>{me?.createdAt ? new Date(me.createdAt).toLocaleDateString("pl-PL") : "—"}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Imię</Label>
            <Input {...register("firstName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nazwisko</Label>
            <Input {...register("lastName")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input {...register("phone")} placeholder="+48 600 100 200" />
        </div>
        <div className="space-y-1.5">
          <Label>Stanowisko</Label>
          <Input {...register("position")} placeholder="np. Serwisant, Menedżer" />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Zapisywanie..." : "Zapisz dane"}
        </Button>
      </form>
    </div>
  );
}

function PasswordTab() {
  const { register, handleSubmit, watch, reset } = useForm<PasswordForm>();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const newPwd = watch("newPassword", "");

  const mutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const r = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      reset();
      toast.success("Hasło zostało zmienione.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allPassed = PASSWORD_RULES.every((r) => r.test(newPwd));

  return (
    <form
      onSubmit={handleSubmit((v) => {
        if (v.newPassword !== v.confirmPassword) {
          toast.error("Hasła nie są identyczne.");
          return;
        }
        mutation.mutate(v);
      })}
      className="space-y-4 max-w-md"
    >
      <div className="space-y-1.5">
        <Label>Obecne hasło</Label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            {...register("currentPassword", { required: true })}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Nowe hasło</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            {...register("newPassword", { required: true })}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {newPwd.length > 0 && (
          <ul className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(newPwd);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${passed ? "text-green-600" : "text-gray-400"}`}
                >
                  {passed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Powtórz nowe hasło</Label>
        <Input type="password" {...register("confirmPassword", { required: true })} />
      </div>

      <Button type="submit" disabled={mutation.isPending || !allPassed}>
        {mutation.isPending ? "Zapisywanie..." : "Zmień hasło"}
      </Button>
    </form>
  );
}

function PreferencesTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await fetch("/api/users/me");
      return r.json();
    },
  });

  const settings = data?.data?.userSettings;

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const r = await fetch("/api/users/me/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Preferencje zapisane.");
    },
    onError: () => toast.error("Błąd zapisu preferencji."),
  });

  if (!settings) return null;

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <p className="font-medium text-sm">Powiadomienia o nowych zleceniach</p>
          <p className="text-xs text-gray-500">Gdy zostaniesz przydzielony do zlecenia</p>
        </div>
        <Switch
          checked={settings.notifyOnAssignment}
          onCheckedChange={(val: boolean) =>
            mutation.mutate({ notifyOnAssignment: val })
          }
        />
      </div>
      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <p className="font-medium text-sm">Powiadomienia o komentarzach</p>
          <p className="text-xs text-gray-500">Gdy ktoś skomentuje Twoje zlecenie</p>
        </div>
        <Switch
          checked={settings.notifyOnComment}
          onCheckedChange={(val: boolean) =>
            mutation.mutate({ notifyOnComment: val })
          }
        />
      </div>
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="font-medium text-sm">Motyw</p>
          <p className="text-xs text-gray-500">Wygląd interfejsu</p>
        </div>
        <select
          value={settings.theme}
          onChange={(e) => mutation.mutate({ theme: e.target.value })}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="light">Jasny</option>
          <option value="dark">Ciemny</option>
        </select>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mój profil</h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="h-4 w-4" />
            Hasło
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Preferencje
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-white rounded-xl border p-5">
            <ProfileTab />
          </div>
        </TabsContent>

        <TabsContent value="password">
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Zmiana hasła</h2>
            <PasswordTab />
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Preferencje</h2>
            <PreferencesTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
