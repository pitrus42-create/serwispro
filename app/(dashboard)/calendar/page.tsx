"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isToday,
  isSameDay,
  isSameMonth,
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

const TYPE_DOT: Record<string, string> = {
  AWARIA: "bg-red-500",
  KONSERWACJA: "bg-amber-400",
  MONTAZ: "bg-green-500",
  MODERNIZACJA: "bg-purple-500",
  INNE: "bg-gray-400",
};

const PRIORITY_BORDER: Record<string, string> = {
  NISKI: "border-l-gray-300",
  NORMALNY: "border-l-red-800",
  WYSOKI: "border-l-orange-500",
  KRYTYCZNY: "border-l-red-500",
};

const WEEK_DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt"];
const MONTH_DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

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

function buildMonthGrid(currentDate: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

// ── Order card (week view) ────────────────────────────────────────────────────

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
  const queryClient = useQueryClient();

  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Week bounds
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon–Fri

  // Month grid
  const monthGridDays = buildMonthGrid(currentDate);
  const gridStart = monthGridDays[0];
  const gridEnd = monthGridDays[monthGridDays.length - 1];

  // Query range
  const from = view === "week" ? weekStart.toISOString() : gridStart.toISOString();
  const to = view === "week" ? weekEnd.toISOString() : gridEnd.toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", view, from],
    queryFn: async () => {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
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
      const aOrder = sorted[idx].extendedProps.dayOrder ?? idx + 1;
      const bOrder = sorted[swapIdx].extendedProps.dayOrder ?? swapIdx + 1;
      dayOrderMutation.mutate({ id: sorted[idx].id, dayOrder: bOrder });
      dayOrderMutation.mutate({ id: sorted[swapIdx].id, dayOrder: aOrder });
    },
    [dayOrderMutation]
  );

  // Navigation
  const prev = () => {
    if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };
  const next = () => {
    if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const isCurrentPeriod =
    view === "week"
      ? isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))
      : isSameMonth(currentDate, new Date());

  const headerLabel =
    view === "week"
      ? `${format(weekStart, "d MMM", { locale: pl })} – ${format(addDays(weekStart, 4), "d MMM yyyy", { locale: pl })}`
      : format(currentDate, "LLLL yyyy", { locale: pl });

  return (
    <div className="p-3 md:p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={next}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 capitalize">{headerLabel}</h2>
          {!isCurrentPeriod && (
            <button
              onClick={goToday}
              className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-800 hover:bg-red-100 transition-colors font-medium"
            >
              Dziś
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                view === "week" ? "bg-red-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              Tydzień
            </button>
            <button
              onClick={() => setView("month")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                view === "month" ? "bg-red-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              Miesiąc
            </button>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => router.push("/orders/new")}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nowe zlecenie</span>
          </Button>
        </div>
      </div>

      {/* ── Week view ──────────────────────────────────────────────────────── */}
      {view === "week" && (
        <>
          {reorderingId && (
            <div className="mb-2 text-xs text-center text-gray-400">
              Użyj strzałek ↑↓ aby zmienić kolejność · kliknij zlecenie aby anulować
            </div>
          )}

          <div className="flex-1 overflow-x-auto">
            <div className="grid grid-cols-5 gap-1.5 min-w-[360px] h-full">
              {weekDays.map((day, i) => {
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
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                      onClick={() =>
                        router.push(`/orders/new?scheduledAt=${format(day, "yyyy-MM-dd")}`)
                      }
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {WEEK_DAY_NAMES[i]}
                      </span>
                      <span
                        className={cn(
                          "text-base font-bold leading-tight",
                          today ? "text-white" : "text-gray-900"
                        )}
                      >
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
                          className="h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-300 transition-colors"
                          onClick={() =>
                            router.push(`/orders/new?scheduledAt=${format(day, "yyyy-MM-dd")}`)
                          }
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
            <span className="ml-auto italic text-gray-400">
              Przytrzymaj zlecenie aby zmienić kolejność
            </span>
          </div>
        </>
      )}

      {/* ── Month view ─────────────────────────────────────────────────────── */}
      {view === "month" && (
        <div className="flex-1 overflow-auto">

          {/* Desktop month grid (md+) */}
          <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-200 gap-px">
              {MONTH_DAY_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={cn(
                    "text-center text-xs font-medium text-gray-500 py-2",
                    i >= 5 ? "bg-amber-50" : "bg-gray-50"
                  )}
                >
                  {name}
                </div>
              ))}
              {monthGridDays.map((day) => {
                const dayOrders = ordersForDay(day);
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[90px] p-1.5",
                      isWeekend
                        ? inMonth ? "bg-amber-50" : "bg-amber-100/60"
                        : inMonth ? "bg-white" : "bg-gray-50"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1 cursor-pointer",
                        today
                          ? "bg-red-800 text-white"
                          : inMonth
                          ? "text-gray-700 hover:bg-gray-100"
                          : "text-gray-300"
                      )}
                      onClick={() =>
                        router.push(`/orders/new?scheduledAt=${format(day, "yyyy-MM-dd")}`)
                      }
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {!isLoading &&
                        dayOrders.slice(0, 3).map((order) => (
                          <div
                            key={order.id}
                            onClick={() => router.push(`/orders/${order.id}`)}
                            className={cn(
                              "text-[10px] truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80",
                              TYPE_COLORS[order.extendedProps.type] ?? "bg-gray-100 text-gray-700"
                            )}
                          >
                            {order.title}
                          </div>
                        ))}
                      {dayOrders.length > 3 && (
                        <div className="text-[10px] text-gray-400 pl-1">
                          +{dayOrders.length - 3} więcej
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile month grid (< md) */}
          <div className="md:hidden">
            <div className="grid grid-cols-7">
              {MONTH_DAY_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={cn(
                    "text-center text-[10px] py-1 font-medium",
                    i >= 5 ? "text-amber-700" : "text-gray-400"
                  )}
                >
                  {name}
                </div>
              ))}
              {monthGridDays.map((day) => {
                const dayOrders = ordersForDay(day);
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const isSelected = selectedDay != null && isSameDay(day, selectedDay);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => {
                      if (!inMonth) return;
                      setSelectedDay(isSelected ? null : day);
                    }}
                    className={cn(
                      "flex flex-col items-center py-1 rounded-lg cursor-pointer",
                      !inMonth && "opacity-20 pointer-events-none",
                      isWeekend && !isSelected && "bg-amber-50",
                      isSelected && "bg-red-50 ring-1 ring-red-200"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        today ? "bg-red-800 text-white" : "text-gray-700"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {/* Colored dots per order */}
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center max-w-[22px]">
                      {dayOrders.slice(0, 4).map((o) => (
                        <span
                          key={o.id}
                          className={cn(
                            "w-1.5 h-1.5 rounded-sm",
                            TYPE_DOT[o.extendedProps.type] ?? "bg-gray-400"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded day order list */}
            {selectedDay && (
              <div className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 capitalize">
                    {format(selectedDay, "EEEE, d MMMM", { locale: pl })}
                  </h3>
                  <button
                    onClick={() =>
                      router.push(
                        `/orders/new?scheduledAt=${format(selectedDay, "yyyy-MM-dd")}`
                      )
                    }
                    className="text-xs text-red-800 font-medium"
                  >
                    + Dodaj
                  </button>
                </div>
                {ordersForDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Brak zleceń na ten dzień
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ordersForDay(selectedDay).map((order) => (
                      <div
                        key={order.id}
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className={cn(
                          "rounded-md border-l-4 bg-white border border-gray-100 px-3 py-2 text-xs cursor-pointer",
                          PRIORITY_BORDER[order.extendedProps.priority] ?? "border-l-gray-300",
                          order.extendedProps.isCritical && "bg-red-50"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={cn(
                              "shrink-0 rounded px-1 py-0.5 font-medium",
                              TYPE_COLORS[order.extendedProps.type] ?? "bg-gray-100 text-gray-700"
                            )}
                          >
                            {TYPE_LABELS[order.extendedProps.type] ?? order.extendedProps.type}
                          </span>
                          <span className="font-medium text-gray-900 truncate">{order.title}</span>
                        </div>
                        {order.extendedProps.clientName && (
                          <p className="text-gray-500 truncate">{order.extendedProps.clientName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
