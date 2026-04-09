"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Plus,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  OCZEKUJACE: "bg-gray-100 text-gray-700",
  PRZYJETE: "bg-blue-100 text-blue-700",
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
  notes: string | null;
  locations: Location[];
  orders: Order[];
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const r = await fetch(`/api/clients/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const client: Client | undefined = data?.data;

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
              <User className="h-5 w-5 text-blue-500" />
            ) : (
              <Building2 className="h-5 w-5 text-blue-500" />
            )}
            <span className="text-sm text-gray-500">{client.type === "OSOBA_PRYWATNA" ? "Osoba prywatna" : client.type === "INSTYTUCJA" ? "Instytucja" : "Firma"}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          {client.alias && <p className="text-sm text-gray-400">{client.alias}</p>}
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/orders/new?clientId=${client.id}`)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Zlecenie
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Contact info */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">Dane kontaktowe</h2>
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Phone className="h-4 w-4 text-gray-400" />
              {client.phone}
            </a>
          )}
          {client.phoneAlt && (
            <a href={`tel:${client.phoneAlt}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Phone className="h-4 w-4 text-gray-400" />
              {client.phoneAlt}
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Mail className="h-4 w-4 text-gray-400" />
              {client.email}
            </a>
          )}
          {client.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              {client.address}
            </div>
          )}
          {client.nip && (
            <p className="text-sm text-gray-500">NIP: {client.nip}</p>
          )}
          {!client.phone && !client.email && !client.address && (
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
          <Button size="sm" variant="outline" className="gap-1">
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
              return (
                <div key={loc.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{loc.name}</p>
                      {loc.address && <p className="text-sm text-gray-500 mt-0.5">{loc.address}</p>}
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
    </div>
  );
}
