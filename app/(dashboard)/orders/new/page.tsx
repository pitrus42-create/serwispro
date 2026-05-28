"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Search, X, Star, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
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
  estimatedDuration: z.string().optional(),
  difficulty: z.number().optional(),
  responsibleId: z.string().optional(),
  helperIds: z.array(z.string()),
});

type FormData = z.infer<typeof schema>;

interface Client {
  id: string;
  name: string | null;
  alias: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
}
interface Location { id: string; name: string; address: string | null; city: string | null; }
interface User { id: string; firstName: string; lastName: string; }

// ── Client autocomplete ────────────────────────────────────────────────────

function ClientSearch({
  value,
  onChange,
  initialClient,
}: {
  value: string | undefined;
  onChange: (clientId: string | undefined, client: Client | undefined) => void;
  initialClient?: Client;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Client | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initialApplied = useRef(false);

  // Apply preloaded client once when it arrives
  useEffect(() => {
    if (initialClient && !initialApplied.current) {
      initialApplied.current = true;
      setSelected(initialClient);
    }
  }, [initialClient]);

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

// ── Difficulty picker ──────────────────────────────────────────────────────────

const DIFFICULTY_COLORS = ["", "text-green-500", "text-green-500", "text-yellow-500", "text-orange-500", "text-red-500"];

function DifficultyPicker({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const current = value ?? 0;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === current ? undefined : n)}
          className="p-0.5 rounded hover:scale-110 transition-transform"
        >
          <Star
            className={cn("h-5 w-5", n <= current ? DIFFICULTY_COLORS[current] : "text-gray-200")}
            fill={n <= current ? "currentColor" : "none"}
          />
        </button>
      ))}
      {current > 0 && (
        <span className="ml-1 text-xs text-gray-500 self-center">
          {["", "Bardzo łatwe", "Łatwe", "Średnie", "Trudne", "Bardzo trudne"][current]}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-2xl mx-auto space-y-4">{[...Array(4)].map((_,i)=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>}>
      <NewOrderForm />
    </Suspense>
  );
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>();
  const [preloadedClient, setPreloadedClient] = useState<Client | undefined>();

  const initialDate = searchParams.get("scheduledAt");
  const initialType = searchParams.get("type") ?? undefined;
  const initialClientId = searchParams.get("clientId") ?? undefined;

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "NORMALNY",
      isCritical: false,
      helperIds: [],
      type: initialType,
      scheduledAt: initialDate ? `${initialDate}T08:00` : undefined,
    },
  });

  const watchType = watch("type");
  const watchClientId = watch("clientId");
  const watchLocationId = watch("locationId");

  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    fetch("/api/users?status=ACTIVE&limit=100").then((r) => r.json()).then((d) => setUsers(d.data ?? []));
  }, []);

  // Preload client from URL param (e.g. when coming from client detail page)
  useEffect(() => {
    if (!initialClientId) return;
    fetch(`/api/clients/${initialClientId}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d.data;
        if (!c?.id) return;
        const clientData: Client = {
          id: c.id,
          name: c.name,
          alias: c.alias,
          phone: c.phone,
          address: c.address,
          city: c.city,
          postalCode: c.postalCode,
        };
        setPreloadedClient(clientData);
        setSelectedClient(clientData);
        setValue("clientId", c.id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);

  // Fetch locations when client changes; auto-select first if available
  useEffect(() => {
    if (!watchClientId) { setLocations([]); setValue("locationId", undefined); return; }
    fetch(`/api/clients/${watchClientId}/locations`)
      .then((r) => r.json())
      .then((d) => {
        const locs: Location[] = d.data ?? [];
        setLocations(locs);
        if (locs.length > 0) {
          setValue("locationId", locs[0].id);
        } else {
          setValue("locationId", undefined);
        }
      })
      .catch(() => { setLocations([]); setValue("locationId", undefined); });
  }, [watchClientId, setValue]);

  function clientAddressLabel(c: Client | undefined): string | null {
    if (!c?.address) return null;
    const postCity = [c.postalCode, c.city].filter(Boolean).join(" ");
    return [c.address, postCity].filter(Boolean).join(", ");
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = { ...data };
      // If no location but client has address, include it in description automatically
      if (!data.locationId && selectedClient) {
        const addr = clientAddressLabel(selectedClient);
        if (addr) {
          payload.description = [
            `Lokalizacja: ${addr}`,
            data.description,
          ].filter(Boolean).join("\n");
        }
      }
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errMsg = "Błąd tworzenia zlecenia";
        try { const err = await res.json(); errMsg = err.error ?? errMsg; } catch {}
        throw new Error(errMsg);
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
                initialClient={preloadedClient}
                onChange={(clientId, client) => {
                  field.onChange(clientId);
                  setSelectedClient(client);
                }}
              />
            )}
          />
        </div>

        {/* Location — shown only when client is selected */}
        {watchClientId && (
          <div className="space-y-1.5">
            <Label>Lokalizacja</Label>
            {locations.length > 0 ? (
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
                          {l.name}{l.address ? ` – ${l.address}` : ""}{l.city ? `, ${l.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : clientAddressLabel(selectedClient) ? (
              <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <p className="font-medium">{clientAddressLabel(selectedClient)}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Adres z danych klienta</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Ten klient nie ma dodanej lokalizacji ani adresu kontaktowego.
              </p>
            )}
          </div>
        )}

        {/* Scheduled date — only start time */}
        <div className="space-y-1.5">
          <Label htmlFor="scheduledAt">Data/godzina</Label>
          <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
        </div>

        {/* Estimated duration + difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Szacowany czas pracy</Label>
            <Controller
              name="estimatedDuration"
              control={control}
              render={({ field }) => (
                <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : v)} value={field.value ?? "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz czas..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nie określono —</SelectItem>
                    <SelectItem value="30min">30 minut</SelectItem>
                    <SelectItem value="1h">1 godzina</SelectItem>
                    <SelectItem value="2h">2 godziny</SelectItem>
                    <SelectItem value="halfday">Pół dnia</SelectItem>
                    <SelectItem value="fullday">Cały dzień</SelectItem>
                    <SelectItem value="2days">2 dni</SelectItem>
                    <SelectItem value="several">Kilka dni</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Trudność</Label>
            <Controller
              name="difficulty"
              control={control}
              render={({ field }) => (
                <DifficultyPicker value={field.value} onChange={field.onChange} />
              )}
            />
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
