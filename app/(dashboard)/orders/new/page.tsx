"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  type: z.string().min(1, "Wybierz typ zlecenia"),
  priority: z.string().min(1),
  isCritical: z.boolean(),
  clientId: z.string().optional(),
  locationId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
  scheduledAt: z.string().optional(),
  scheduledEndAt: z.string().optional(),
  responsibleId: z.string().optional(),
  helperIds: z.array(z.string()),
});

type FormData = z.infer<typeof schema>;

interface Client { id: string; name: string | null; alias: string | null; phone: string | null; }
interface Location { id: string; name: string; address: string | null; }
interface User { id: string; firstName: string; lastName: string; }

// ── Client autocomplete ────────────────────────────────────────────────────

function ClientSearch({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (clientId: string | undefined, client: Client | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Client | undefined>();
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/clients?q=${encodeURIComponent(query)}&limit=8`);
        const d = await r.json();
        setResults(d.data ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function select(c: Client) {
    setSelected(c);
    setQuery("");
    setOpen(false);
    onChange(c.id, c);
  }

  function clear() {
    setSelected(undefined);
    setQuery("");
    onChange(undefined, undefined);
  }

  function clientLabel(c: Client) {
    const parts = [c.name, c.alias].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Klient bez nazwy";
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-gray-50">
        <div>
          <p className="text-sm font-medium text-gray-900">{clientLabel(selected)}</p>
          {selected.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
        </div>
        <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Szukaj po nazwie, telefonie, pseudonimie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Szukam...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Brak wyników</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{clientLabel(c)}</p>
                {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewOrderPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "NORMALNY", isCritical: false, helperIds: [] },
  });

  const watchType = watch("type");
  const watchClientId = watch("clientId");

  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!watchClientId) { setLocations([]); return; }
    fetch(`/api/clients/${watchClientId}/locations`)
      .then((r) => r.json())
      .then((d) => setLocations(d.data ?? []))
      .catch(() => setLocations([]));
    setValue("locationId", undefined);
  }, [watchClientId, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Błąd tworzenia zlecenia");
      }
      const { data: order } = await res.json();
      toast.success(`Zlecenie ${order.orderNumber} zostało utworzone`);
      router.push(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd tworzenia zlecenia");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Nowe zlecenie</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white rounded-xl border p-5">
        {/* Type */}
        <div className="space-y-1.5">
          <Label>Typ zlecenia *</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className={errors.type ? "border-red-500" : ""}>
                  <SelectValue placeholder="Wybierz typ..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWARIA">Awaria</SelectItem>
                  <SelectItem value="KONSERWACJA">Konserwacja</SelectItem>
                  <SelectItem value="MONTAZ">Montaż</SelectItem>
                  <SelectItem value="MODERNIZACJA">Modernizacja</SelectItem>
                  <SelectItem value="INNE">Inne</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <Label>Priorytet</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NISKI">Niski</SelectItem>
                  <SelectItem value="NORMALNY">Normalny</SelectItem>
                  <SelectItem value="WYSOKI">Wysoki</SelectItem>
                  <SelectItem value="KRYTYCZNY">Krytyczny</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Critical flag - only for AWARIA */}
        {watchType === "AWARIA" && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Awaria krytyczna</p>
                <p className="text-xs text-red-600">Powiadomi wszystkich administratorów</p>
              </div>
            </div>
            <Controller
              name="isCritical"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Tytuł / opis skrócony</Label>
          <Input id="title" {...register("title")} placeholder="Krótki opis problemu..." />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Szczegółowy opis</Label>
          <Textarea id="description" {...register("description")} rows={3} placeholder="Dokładny opis zlecenia..." />
        </div>

        {/* Client autocomplete */}
        <div className="space-y-1.5">
          <Label>Klient</Label>
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <ClientSearch
                value={field.value}
                onChange={(clientId, _client) => field.onChange(clientId)}
              />
            )}
          />
        </div>

        {/* Location */}
        {watchClientId && locations.length > 0 && (
          <div className="space-y-1.5">
            <Label>Lokalizacja</Label>
            <Controller
              name="locationId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz lokalizację..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} {l.address ? `– ${l.address}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        {/* Scheduled date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">Data/godzina (od)</Label>
            <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledEndAt">Data/godzina (do)</Label>
            <Input id="scheduledEndAt" type="datetime-local" {...register("scheduledEndAt")} />
          </div>
        </div>

        {/* Responsible */}
        <div className="space-y-1.5">
          <Label>Odpowiedzialny serwisant</Label>
          <Controller
            name="responsibleId"
            control={control}
            render={({ field }) => (
              <Select
                onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                value={field.value ?? "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz serwisanta..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nieprzypisany —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Internal notes */}
        <div className="space-y-1.5">
          <Label htmlFor="internalNotes">Notatki wewnętrzne</Label>
          <Textarea id="internalNotes" {...register("internalNotes")} rows={2} placeholder="Widoczne tylko dla zespołu..." />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            Anuluj
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Tworzenie..." : "Utwórz zlecenie"}
          </Button>
        </div>
      </form>
    </div>
  );
}
