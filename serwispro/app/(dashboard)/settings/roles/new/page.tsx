"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

type FormValues = {
  displayName: string;
  name: string;
  description: string;
};

export default function NewRolePage() {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>();
  const displayName = watch("displayName", "");
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const { data: permsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const r = await fetch("/api/permissions");
      return r.json();
    },
  });

  const grouped: Record<
    string,
    Array<{ id: string; displayName: string; action: string }>
  > = permsData?.data ?? {};

  // Auto-generate name from displayName
  function slugify(val: string) {
    return val
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const r = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          displayName: values.displayName,
          description: values.description || undefined,
          permissionIds: selectedPermIds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Błąd tworzenia roli.");
      return data;
    },
    onSuccess: () => {
      toast.success("Rola została utworzona.");
      router.push("/settings/roles");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowa rola</h1>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Informacje o roli</h2>
          <div className="space-y-1.5">
            <Label>
              Nazwa wyświetlana <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register("displayName", { required: true })}
              placeholder="np. Kierownik projektu"
              onChange={(e) => {
                setValue("displayName", e.target.value);
                setValue("name", slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Kod roli (nazwa systemowa) <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register("name", { required: true })}
              placeholder="KIEROWNIK_PROJEKTU"
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Używany w kodzie. Tylko wielkie litery, cyfry i podkreślenia.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Opis</Label>
            <Textarea
              {...register("description")}
              placeholder="Krótki opis zakresu roli..."
              rows={2}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Uprawnienia</h2>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="text-red-800 hover:underline"
                onClick={() => {
                  const all = Object.values(grouped)
                    .flat()
                    .map((p) => p.id);
                  setSelectedPermIds(all);
                }}
              >
                Zaznacz wszystkie
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                className="text-gray-500 hover:underline"
                onClick={() => setSelectedPermIds([])}
              >
                Odznacz
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {Object.keys(grouped).map((module) => (
              <div key={module}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {MODULE_LABELS[module] ?? module}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {grouped[module].map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedPermIds.includes(p.id)}
                        onChange={(e) => {
                          setSelectedPermIds((prev) =>
                            e.target.checked
                              ? [...prev, p.id]
                              : prev.filter((id) => id !== p.id)
                          );
                        }}
                      />
                      {p.displayName}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending || !displayName} className="flex-1">
            {mutation.isPending ? "Tworzenie..." : "Utwórz rolę"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Anuluj
          </Button>
        </div>
      </form>
    </div>
  );
}
