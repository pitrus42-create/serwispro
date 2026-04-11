"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Plus, Search, Filter, AlertTriangle, Clock, ChevronRight, X, SlidersHorizontal, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { canDo } from "@/lib/permissions";
import { toast } from "sonner";

// ── Constants ───────────────────────────────────────────────────────────────

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

type DatePreset = "all" | "today" | "week" | "month";

function getDateRange(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (preset === "today")
    return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
  if (preset === "week")
    return { dateFrom: startOfWeek(now, { locale: pl }).toISOString(), dateTo: endOfWeek(now, { locale: pl }).toISOString() };
  if (preset === "month")
    return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
  return {};
}

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderAssignment {
  user: { id: string; firstName: string; lastName: string };
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

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchOrders(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/orders?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

async function fetchUsers(): Promise<{ data: UserOption[] }> {
  const res = await fetch("/api/users?limit=100");
  if (!res.ok) return { data: [] };
  return res.json();
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:bg-blue-200 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canCreateOrders = canDo(session?.user, "orders:create");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [userId, setUserId] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,
  });
  const users: UserOption[] = usersData?.data ?? [];

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (search) params.q = search;
  if (status !== "all") params.status = status;
  if (type !== "all") params.type = type;
  if (priority !== "all") params.priority = priority;
  if (userId !== "all") params.userId = userId;
  if (dateRange.dateFrom) params.dateFrom = dateRange.dateFrom;
  if (dateRange.dateTo) params.dateTo = dateRange.dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", params],
    queryFn: () => fetchOrders(params),
    refetchInterval: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/orders/${orderId}/accept`, { method: "POST" });
      if (!r.ok) throw new Error("Błąd");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Zlecenie przyjęte");
    },
    onError: () => toast.error("Błąd przyjęcia zlecenia"),
  });

  const orders: Order[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // Active filter chips (excluding search and page)
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (status !== "all") activeFilters.push({ label: STATUS_LABELS[status] ?? status, clear: () => { setStatus("all"); setPage(1); } });
  if (type !== "all") activeFilters.push({ label: TYPE_LABELS[type] ?? type, clear: () => { setType("all"); setPage(1); } });
  if (priority !== "all") activeFilters.push({ label: priority, clear: () => { setPriority("all"); setPage(1); } });
  if (userId !== "all") {
    const u = users.find((u) => u.id === userId);
    activeFilters.push({ label: u ? `${u.firstName} ${u.lastName}` : "Pracownik", clear: () => { setUserId("all"); setPage(1); } });
  }
  if (datePreset !== "all") {
    const labels: Record<DatePreset, string> = { all: "", today: "Dziś", week: "Ten tydzień", month: "Ten miesiąc" };
    activeFilters.push({ label: labels[datePreset], clear: () => { setDatePreset("all"); setPage(1); } });
  }

  function clearAll() {
    setSearch(""); setStatus("all"); setType("all"); setPriority("all");
    setUserId("all"); setDatePreset("all"); setPage(1);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zlecenia</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} zleceń</p>
        </div>
        {canCreateOrders && (
          <Button onClick={() => router.push("/orders/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nowe zlecenie</span>
          </Button>
        )}
      </div>

      {/* Search + toggle filters */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Szukaj po numerze, tytule, opisie..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button
          variant={filtersOpen || activeFilters.length > 0 ? "default" : "outline"}
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Filtry"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </div>

      {/* Filter dropdowns — always visible on md, collapsible on mobile */}
      <div className={cn(
        "md:flex flex-col sm:flex-row gap-3 mb-3",
        filtersOpen ? "flex" : "hidden"
      )}>
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

        <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Pracownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy pracownicy</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Każda data</SelectItem>
            <SelectItem value="today">Dziś</SelectItem>
            <SelectItem value="week">Ten tydzień</SelectItem>
            <SelectItem value="month">Ten miesiąc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map((f) => (
            <FilterChip key={f.label} label={f.label} onRemove={f.clear} />
          ))}
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-center"
          >
            Wyczyść wszystko
          </button>
        </div>
      )}

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
          {activeFilters.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>
              Wyczyść filtry
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const lead = order.assignments.find((a) => a.isLead);
            const isUnassigned = order.assignments.length === 0;
            const isMyOrder = order.assignments.some((a) => a.user.id === session?.user?.id);
            const canAccept = !canCreateOrders && (isUnassigned || (!isMyOrder && order.assignments.length > 0 && isUnassigned)) && ["OCZEKUJACE", "PRZYJETE"].includes(order.status) && !isMyOrder;
            return (
              <div
                key={order.id}
                className={cn(
                  "bg-white rounded-lg border p-4 hover:shadow-md transition-shadow",
                  order.isCritical && "border-red-300 bg-red-50"
                )}
              >
                <div className="flex items-start gap-3" onClick={() => router.push(`/orders/${order.id}`)}>
                  {order.isCritical && (
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  )}
                  <div className="flex-1 min-w-0 cursor-pointer">
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
                      {isUnassigned && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Nieprzypisane
                        </span>
                      )}
                      {isMyOrder && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Moje
                        </span>
                      )}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {canAccept && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-1 text-xs"
                        disabled={acceptMutation.isPending}
                        onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(order.id); }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Przyjmij
                      </Button>
                    )}
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Poprzednia
          </Button>
          <span className="flex items-center text-sm text-gray-600 px-3">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Następna
          </Button>
        </div>
      )}
    </div>
  );
}
