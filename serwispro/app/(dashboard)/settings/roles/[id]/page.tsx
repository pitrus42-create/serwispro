"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
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

type FormValues = { displayName: string; description: string };

export default function EditRolePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const { data: roleData, isLoading } = useQuery({
    queryKey: ["role", id],
    queryFn: async () => {
      const r = await fetch(`/api/roles/${id}`);
      return r.json();
    },
  });

  const { data: permsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const r = await fetch("/api/permissions");
      return r.json();
    },
  });

  const role = roleData?.data;
  const grouped: Record<
    string,
    Array<{ id: string; displayName: string; action: string }>
  > = permsData?.data ?? {};

  const { register, handleSubmit, reset } = useForm<FormValues>();

  useEffect(() => {
    if (role) {
      reset({
        displayName: role.displayName,
        description: role.description ?? "",
      });
      setSelectedPermIds(
        role.rolePermissions?.map(
          (rp: { permissionId: string }) => rp.permissionId
        ) ?? []
      );
    }
  }, [role, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const r = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: values.displayName,
          description: values.description || undefined,
          permissionIds: selectedPermIds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Błąd zapisu roli.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", id] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rola została zaktualizowana.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-6 text-gray-400">Ładowanie...</div>;
  }

  if (!role) {
    return <div className="p-6 text-gray-500">Nie znaleziono roli.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Edytuj rolę: {role.displayName}
      </h1>
      <p className="text-sm text-gray-400 font-mono mb-6">{role.name}</p>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Informacje o roli</h2>
          <div className="space-y-1.5">
            <Label>Nazwa wyświetlana</Label>
            <Input {...register("displayName", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Opis</Label>
            <Textarea {...register("description")} rows={2} />
          </div>
          {role.isSystem && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded p-2">
              To jest rola systemowa — kodu roli ({role.name}) nie można zmieniać.
            </p>
          )}
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
                              : prev.filter((pid) => pid !== p.id)
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

        <Button type="submit" disabled={mutation.isPending} className="gap-2 w-full">
          <Save className="h-4 w-4" />
          {mutation.isPending ? "Zapisywanie..." : "Zapisz rolę"}
        </Button>
      </form>
    </div>
  );
}
