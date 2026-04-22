"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, User,
  Plus, ChevronRight, Clock, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { isAdmin, hasRole } from "@/lib/permissions";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_COLORS: Record<string, string> = {
  OCZEKUJACE: "bg-gray-100 text-gray-700",
  PRZYJETE: "bg-red-100 text-red-900",
  W_TOKU: "bg-amber-100 text-amber-700",
  ZAPLANOWANE: "bg-purple-100 text-purple-700",
  ZAKONCZONE: "bg-green-100 text-green-700",
  ANULOWANE: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  OCZEKUJACE: "Oczekujące",
  PRZYJETE: "Przyjęte",
  W_TOKU: "W toku",
  ZAPLANOWANE: "Zaplanowane",
  ZAKONCZONE: "Zakończone",
  ANULOWANE: "Anulowane",
};

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  systemType: string | null;
  nextMaintenanceDate: string | null;
  isActive: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  title: string | null;
  scheduledAt: string | null;
  isCritical: boolean;
  assignments: Array<{ isLead: boolean; user: { firstName: string; lastName: string } }>;
}

interface Client {
  id: string;
  name: string;
  type: string;
  alias: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  nip: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
  locations: Location[];
  orders: Order[];
}

// ── Edit Client Dialog ──────────────────────────────────────────────────────

function EditClientDialog({
  client,
  open,
  onClose,
  onSaved,
}: {
  client: Client;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    type: client.type,
    name: client.name ?? "",
    alias: client.alias ?? "",
    nip: client.nip ?? "",
    phone: client.phone ?? "",
    phoneAlt: client.phoneAlt ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    postalCode: client.postalCode ?? "",
    notes: client.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        body[k] = v.trim() === "" ? null : v.trim();
      }
      const r = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Błąd zapisu");
      toast.success("Dane klienta zostały zaktualizowane");
      onSaved();
      onClose();
    } catch {
      toast.error("Nie udało się zapisać zmian");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj klienta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Typ klienta</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIRMA">Firma</SelectItem>
                <SelectItem value="OSOBA_PRYWATNA">Osoba prywatna</SelectItem>
                <SelectItem value="INSTYTUCJA">Instytucja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nazwa</Label>
            <Input value={form.name} onChange={set("name")} placeholder="Nazwa firmy lub imię i nazwisko" />
          </div>

          <div className="space-y-1.5">
            <Label>Wewnętrzna nazwa / pseudonim</Label>
            <Input value={form.alias} onChange={set("alias")} placeholder="Skrócona nazwa do wyszukiwania..." />
            <p className="text-xs text-gray-400">Widoczna tylko wewnętrznie — nie pojawia się w protokołach</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+48 600 100 200" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon alternatywny</Label>
              <Input value={form.phoneAlt} onChange={set("phoneAlt")} placeholder="+48 22 100 200" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="kontakt@firma.pl" />
            </div>
            <div className="space-y-1.5">
              <Label>NIP</Label>
              <Input value={form.nip} onChange={set("nip")} placeholder="1234567890" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ulica / adres</Label>
            <Input value={form.address} onChange={set("address")} placeholder="ul. Przykładowa 1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kod pocztowy</Label>
              <Input value={form.postalCode} onChange={set("postalCode")} placeholder="00-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Miasto</Label>
              <Input value={form.city} onChange={set("city")} placeholder="Warszawa" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notatki</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Dodatkowe informacje..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Location Dialog ─────────────────────────────────────────────────────

function AddLocationDialog({
  clientId,
  open,
  onClose,
  onSaved,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    postalCode: "",
    technicalNote: "",
    systemsNote: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nazwa lokalizacji jest wymagana");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/clients/${clientId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          postalCode: form.postalCode.trim() || null,
          technicalNote: form.technicalNote.trim() || null,
          systemsNote: form.systemsNote.trim() || null,
        }),
      });
      if (!r.ok) throw new Error("Błąd zapisu");
      toast.success("Lokalizacja została dodana");
      setForm({ name: "", address: "", city: "", postalCode: "", technicalNote: "", systemsNote: "" });
      onSaved();
      onClose();
    } catch {
      toast.error("Nie udało się dodać lokalizacji");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj lokalizację</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nazwa lokalizacji *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="np. Budynek A, Hala produkcyjna..." />
          </div>

          <div className="space-y-1.5">
            <Label>Ulica / adres</Label>
            <Input value={form.address} onChange={set("address")} placeholder="ul. Przykładowa 1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kod pocztowy</Label>
              <Input value={form.postalCode} onChange={set("postalCode")} placeholder="00-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Miasto</Label>
              <Input value={form.city} onChange={set("city")} placeholder="Warszawa" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notatka techniczna</Label>
            <Textarea value={form.technicalNote} onChange={set("technicalNote")} rows={2} placeholder="Informacje techniczne o obiekcie..." />
          </div>

          <div className="space-y-1.5">
            <Label>Zainstalowane systemy</Label>
            <Textarea value={form.systemsNote} onChange={set("systemsNote")} rows={2} placeholder="np. CCTV, SSWiN, SKD..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Dodawanie..." : "Dodaj lokalizację"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);

  const canDelete = isAdmin(session?.user);
  const canEdit = isAdmin(session?.user) || hasRole(session?.user, "SZEF") || hasRole(session?.user, "MENEDZER");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Błąd usunięcia");
    },
    onSuccess: () => {
      toast.success("Klient został usunięty");
      router.push("/clients");
    },
    onError: () => toast.error("Błąd usunięcia klienta"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const r = await fetch(`/api/clients/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const client: Client | undefined = data?.data;

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["client", id] });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Nie znaleziono klienta</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/clients")}>
          Powrót
        </Button>
      </div>
    );
  }

  const activeLocations = client.locations.filter((l) => l.isActive);
  const activeOrders = client.orders.filter((o) => !["ZAKONCZONE", "ANULOWANE"].includes(o.status));

  const addressLine = [client.address, client.postalCode, client.city].filter(Boolean).join(", ");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {client.type === "OSOBA_PRYWATNA" ? (
              <User className="h-5 w-5 text-red-700" />
            ) : (
              <Building2 className="h-5 w-5 text-red-700" />
            )}
            <span className="text-sm text-gray-500">{client.type === "OSOBA_PRYWATNA" ? "Osoba prywatna" : client.type === "INSTYTUCJA" ? "Instytucja" : "Firma"}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          {client.alias && <p className="text-sm text-gray-400">{client.alias}</p>}
          {addressLine && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {addressLine}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edytuj</span>
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Usuń</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => router.push(`/orders/new?clientId=${client.id}`)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Zlecenie
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Contact info */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">Dane kontaktowe</h2>
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-red-800 hover:underline">
              <Phone className="h-4 w-4 text-gray-400" />
              {client.phone}
            </a>
          )}
          {client.phoneAlt && (
            <a href={`tel:${client.phoneAlt}`} className="flex items-center gap-2 text-sm text-red-800 hover:underline">
              <Phone className="h-4 w-4 text-gray-400" />
              {client.phoneAlt}
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-red-800 hover:underline">
              <Mail className="h-4 w-4 text-gray-400" />
              {client.email}
            </a>
          )}
          {addressLine && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              {addressLine}
            </div>
          )}
          {client.nip && (
            <p className="text-sm text-gray-500">NIP: {client.nip}</p>
          )}
          {!client.phone && !client.email && !addressLine && (
            <p className="text-sm text-gray-400">Brak danych kontaktowych</p>
          )}
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-700 mb-2">Notatki</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Lokalizacje ({activeLocations.length})</h2>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddLocationOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Dodaj
          </Button>
        </div>
        {activeLocations.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border rounded-xl bg-white">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Brak lokalizacji</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeLocations.map((loc) => {
              const isOverdue = loc.nextMaintenanceDate && new Date(loc.nextMaintenanceDate) < new Date();
              const locAddress = [loc.address, loc.postalCode, loc.city].filter(Boolean).join(", ");
              return (
                <div key={loc.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{loc.name}</p>
                      {locAddress && <p className="text-sm text-gray-500 mt-0.5">{locAddress}</p>}
                      {loc.systemType && (
                        <p className="text-xs text-gray-400 mt-1">{loc.systemType}</p>
                      )}
                    </div>
                    {loc.nextMaintenanceDate && (
                      <div className={cn("text-right text-xs", isOverdue ? "text-red-600" : "text-gray-500")}>
                        <p className="flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {isOverdue ? "Przeterminowane!" : "Następny przegląd"}
                        </p>
                        <p className="font-medium">
                          {format(new Date(loc.nextMaintenanceDate), "d MMM yyyy", { locale: pl })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">
            Zlecenia ({client.orders.length})
            {activeOrders.length > 0 && (
              <span className="ml-2 text-sm font-normal text-amber-600">{activeOrders.length} aktywnych</span>
            )}
          </h2>
        </div>
        {client.orders.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border rounded-xl bg-white">
            <p className="text-sm">Brak zleceń</p>
          </div>
        ) : (
          <div className="space-y-2">
            {client.orders.map((order) => {
              const lead = order.assignments.find((a) => a.isLead);
              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="bg-white rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow flex items-center gap-3"
                >
                  {order.isCritical && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400">{order.orderNumber}</span>
                      <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-xs text-gray-500">{TYPE_LABELS[order.type] ?? order.type}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {order.title ?? `Zlecenie ${order.orderNumber}`}
                    </p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      {order.scheduledAt && (
                        <span>{format(new Date(order.scheduledAt), "d MMM, HH:mm", { locale: pl })}</span>
                      )}
                      {lead && <span>{lead.user.firstName} {lead.user.lastName}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {editOpen && (
        <EditClientDialog
          client={client}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={refetch}
        />
      )}

      {/* Add location dialog */}
      <AddLocationDialog
        clientId={id}
        open={addLocationOpen}
        onClose={() => setAddLocationOpen(false)}
        onSaved={refetch}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń klienta</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz trwale usunąć klienta <strong>{client.name ?? client.alias ?? "bez nazwy"}</strong>?
              <br /><br />
              Zlecenia powiązane z tym klientem zostaną zachowane, ale stracą przypisanie do klienta.
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
            >
              Usuń trwale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
