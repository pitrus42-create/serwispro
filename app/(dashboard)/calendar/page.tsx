"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  isToday, isSameDay,
} from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Aw",
  KONSERWACJA: "Ko",
  MONTAZ: "Mo",
  MODERNIZACJA: "Md",
  INNE: "In",
};

const TYPE_COLORS: Record<string, string> = {
  AWARIA: "bg-red-100 text-red-800",
  KONSERWACJA: "bg-amber-100 text-amber-800",
  MONTAZ: "bg-green-100 text-green-800",
  MODERNIZACJA: "bg-purple-100 text-purple-800",
  INNE: "bg-gray-100 text-gray-700",
};

const PRIORITY_BORDER: Record<string, string> = {
  NISKI: "border-l-gray-300",
  NORMALNY: "border-l-red-800",
  WYSOKI: "border-l-orange-500",
  KRYTYCZNY: "border-l-red-500",
};

const DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarOrder {
  id: string;
  orderNumber: string;
  title: string;
  start: string | null;
  extendedProps: {
    type: string;
    status: string;
    priority: string;
    isCritical: boolean;
    clientName: string | null;
    leadName: string | null;
    isMyOrder: boolean;
    dayOrder: number | null;
    note: string | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstLine(text: string | null): string | null {
  if (!text) return null;
  const line = text.split("\n")[0].trim();
  return line.length > 60 ? line.slice(0, 60) + "…" : line || null;
}

function sortOrders(orders: CalendarOrder[]): CalendarOrder[] {
  return [...orders].sort((a, b) => {
    const da = a.extendedProps.dayOrder ?? 9999;
    const db = b.extendedProps.dayOrder ?? 9999;
    if (da !== db) return da - db;
    const ta = a.start ? new Date(a.start).getTime() : 0;
    const tb = b.start ? new Date(b.start).getTime() : 0;
    return ta - tb;
  });
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  isReordering,
  isFirst,
  isLast,
  onLongPress,
  onMoveUp,
  onMoveDown,
  onDismissReorder,
}: {
  order: CalendarOrder;
  isReordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onLongPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDismissReorder: () => void;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  function startPress() {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, 500);
  }

  function cancelPress() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function handleClick() {
    if (didLongPress.current) return;
    if (isReordering) { onDismissReorder(); return; }
    router.push(`/orders/${order.id}`);
  }

  const { type, priority, isCritical, clientName, leadName, isMyOrder, note } = order.extendedProps;
  const noteLine = getFirstLine(note);

  return (
    <div
      className={cn(
        "relative rounded-md border-l-4 bg-white border border-gray-100 px-2.5 py-2 text-xs cursor-pointer select-none transition-all",
        PRIORITY_BORDER[priority] ?? "border-l-gray-300",
        isReordering && "ring-2 ring-red-800 shadow-md",
        isCritical && "bg-red-50",
        !isMyOrder && "opacity-70"
      )}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onClick={handleClick}
    >
      <div className="flex items-start gap-1.5">
        {isCritical && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />}
        <span className={cn("shrink-0 rounded px-1 py-0.5 font-medium", TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700")}>
          {TYPE_LABELS[type] ?? type}
        </span>
        <span className="font-medium text-gray-900 leading-tight line-clamp-2">
          {order.title}
        </span>
      </div>
      {clientName && (
        <p className="mt-0.5 text-gray-500 truncate pl-0.5">{clientName}</p>
      )}
      {noteLine && (
        <p className="mt-0.5 text-gray-400 italic truncate pl-0.5">{noteLine}</p>
      )}
      {leadName && !isMyOrder && (
        <p className="mt-0.5 text-gray-400 truncate pl-0.5">👤 {leadName}</p>
      )}

      {/* Reorder controls */}
      {isReordering && (
        <div
          className="absolute right-1 top-1 flex flex-col gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            disabled={isFirst}
            onClick={onMoveUp}
            className="p-0.5 rounded bg-red-800 text-white disabled:opacity-30 hover:bg-red-900"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            disabled={isLast}
            onClick={onMoveDown}
            className="p-0.5 rounded bg-red-800 text-white disabled:opacity-30 hover:bg-red-900"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-week", weekStart.toISOString()],
    queryFn: async () => {
      const from = weekStart.toISOString();
      const to = weekEnd.toISOString();
      const r = await fetch(`/api/calendar?from=${from}&to=${to}`);
      return r.json();
    },
    staleTime: 30_000,
  });

  const dayOrderMutation = useMutation({
    mutationFn: async ({ id, dayOrder }: { id: string; dayOrder: number }) => {
      const r = await fetch(`/api/orders/${id}/dayorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOrder }),
      });
      if (!r.ok) throw new Error("Błąd");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-week"] }),
    onError: () => toast.error("Błąd zmiany kolejności"),
  });

  const allOrders: CalendarOrder[] = data?.data ?? [];

  function ordersForDay(day: Date): CalendarOrder[] {
    return sortOrders(
      allOrders.filter((o) => o.start && isSameDay(new Date(o.start), day))
    );
  }

  const handleMoveOrder = useCallback(
    (order: CalendarOrder, dayOrders: CalendarOrder[], direction: "up" | "down") => {
      const idx = dayOrders.findIndex((o) => o.id === order.id);
      const sorted = [...dayOrders];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      // Swap dayOrder values
      const aOrder = sorted[idx].extendedProps.dayOrder ?? idx + 1;
      const bOrder = sorted[swapIdx].extendedProps.dayOrder ?? swapIdx + 1;
      dayOrderMutation.mutate({ id: sorted[idx].id, dayOrder: bOrder });
      dayOrderMutation.mutate({ id: sorted[swapIdx].id, dayOrder: aOrder });
    },
    [dayOrderMutation]
  );

  const prevWeek = () => setWeekStart((w) => subWeeks(w, 1));
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const isCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  return (
    <div className="p-3 md:p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            {format(weekStart, "d MMM", { locale: pl })} –{" "}
            {format(weekEnd, "d MMM yyyy", { locale: pl })}
          </h2>
          {!isCurrentWeek && (
            <button
              onClick={goToday}
              className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-800 hover:bg-red-100 transition-colors font-medium"
            >
              Dziś
            </button>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => router.push("/orders/new")}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nowe zlecenie</span>
        </Button>
      </div>

      {/* Instruction */}
      {reorderingId && (
        <div className="mb-2 text-xs text-center text-gray-400">
          Użyj strzałek ↑↓ aby zmienić kolejność · kliknij zlecenie aby anulować
        </div>
      )}

      {/* Week grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1.5 min-w-[560px] h-full">
          {days.map((day, i) => {
            const dayOrders = ordersForDay(day);
            const today = isToday(day);

            return (
              <div key={day.toISOString()} className="flex flex-col min-w-0">
                {/* Day header */}
                <div
                  className={cn(
                    "flex flex-col items-center py-1.5 rounded-lg mb-1.5 cursor-pointer transition-colors",
                    today
                      ? "bg-red-800 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  )}
                  onClick={() => router.push(`/orders/new?scheduledAt=${format(day, "yyyy-MM-dd")}`)}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {DAY_NAMES[i]}
                  </span>
                  <span className={cn("text-base font-bold leading-tight", today ? "text-white" : "text-gray-900")}>
                    {format(day, "d")}
                  </span>
                  <span className="text-[10px] opacity-70">
                    {format(day, "MMM", { locale: pl })}
                  </span>
                </div>

                {/* Orders */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
                  {isLoading ? (
                    <div className="space-y-1">
                      {[1, 2].map((n) => (
                        <div key={n} className="h-12 bg-gray-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : dayOrders.length === 0 ? (
                    <div
                      className="h-16 rounded-lg border-2 border-dashed border-gray-100 flex items-center justify-center cursor-pointer hover:border-gray-200 transition-colors"
                      onClick={() => router.push(`/orders/new?scheduledAt=${format(day, "yyyy-MM-dd")}`)}
                    >
                      <Plus className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  ) : (
                    dayOrders.map((order, idx) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        isReordering={reorderingId === order.id}
                        isFirst={idx === 0}
                        isLast={idx === dayOrders.length - 1}
                        onLongPress={() => setReorderingId(order.id)}
                        onDismissReorder={() => setReorderingId(null)}
                        onMoveUp={() => handleMoveOrder(order, dayOrders, "up")}
                        onMoveDown={() => handleMoveOrder(order, dayOrders, "down")}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-1 rounded-full bg-gray-300 inline-block" /> Niski
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-1 rounded-full bg-red-800 inline-block" /> Normalny
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-1 rounded-full bg-orange-500 inline-block" /> Wysoki
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-1 rounded-full bg-red-500 inline-block" /> Krytyczny
        </span>
        <span className="ml-auto italic text-gray-400">Przytrzymaj zlecenie aby zmienić kolejność</span>
      </div>
    </div>
  );
}
