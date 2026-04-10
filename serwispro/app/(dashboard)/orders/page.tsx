"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Plus, Search, Filter, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  OCZEKUJACE: "Oczekujące",
  PRZYJETE: "Przyjęte",
  W_TOKU: "W toku",
  ZAPLANOWANE: "Zaplanowane",
  ZAKONCZONE: "Zakończone",
  ANULOWANE: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  OCZEKUJACE: "bg-gray-100 text-gray-700",
  PRZYJETE: "bg-blue-100 text-blue-700",
  W_TOKU: "bg-amber-100 text-amber-700",
  ZAPLANOWANE: "bg-purple-100 text-purple-700",
  ZAKONCZONE: "bg-green-100 text-green-700",
  ANULOWANE: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  NISKI: "bg-gray-100 text-gray-600",
  NORMALNY: "bg-blue-100 text-blue-600",
  WYSOKI: "bg-orange-100 text-orange-600",
  KRYTYCZNY: "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

interface OrderAssignment {
  user: { firstName: string; lastName: string };
  isLead: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  priority: string;
  isCritical: boolean;
  title: string | null;
  scheduledAt: string | null;
  client: { name: string } | null;
  location: { name: string; address: string | null } | null;
  assignments: OrderAssignment[];
}

async function fetchOrders(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/orders?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (search) params.q = search;
  if (status !== "all") params.status = status;
  if (type !== "all") params.type = type;
  if (priority !== "all") params.priority = priority;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", params],
    queryFn: () => fetchOrders(params),
    refetchInterval: 30_000,
  });

  const orders: Order[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zlecenia</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} zleceń łącznie</p>
        </div>
        <Button onClick={() => router.push("/orders/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nowe zlecenie</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Szukaj zleceń..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie typy</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Priorytet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie priorytety</SelectItem>
            <SelectItem value="KRYTYCZNY">Krytyczny</SelectItem>
            <SelectItem value="WYSOKI">Wysoki</SelectItem>
            <SelectItem value="NORMALNY">Normalny</SelectItem>
            <SelectItem value="NISKI">Niski</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Filter className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Brak zleceń</p>
          <p className="text-sm mt-1">Zmień filtry lub utwórz nowe zlecenie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const lead = order.assignments.find((a) => a.isLead);
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className={cn(
                  "bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow",
                  order.isCritical && "border-red-300 bg-red-50"
                )}
              >
                <div className="flex items-start gap-3">
                  {order.isCritical && (
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{order.orderNumber}</span>
                      <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                      <Badge className={cn("text-xs", PRIORITY_COLORS[order.priority])}>
                        {order.priority}
                      </Badge>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[order.type] ?? order.type}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">
                      {order.title ?? order.client?.name ?? `Zlecenie ${order.orderNumber}`}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      {order.client && <span>{order.client.name}</span>}
                      {order.location && (
                        <span className="truncate">{order.location.address ?? order.location.name}</span>
                      )}
                      {order.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(order.scheduledAt), "d MMM, HH:mm", { locale: pl })}
                        </span>
                      )}
                      {lead && (
                        <span>{lead.user.firstName} {lead.user.lastName}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Poprzednia
          </Button>
          <span className="flex items-center text-sm text-gray-600 px-3">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Następna
          </Button>
        </div>
      )}
    </div>
  );
}
