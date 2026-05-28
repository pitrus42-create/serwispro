"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { ChevronLeft, ChevronRight, Plus, ChevronUp, ChevronDown, AlertTriangle, CheckSquare, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isAdmin, canDo } from "@/lib/permissions";

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

const USER_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#F97316", "#14B8A6", "#EC4899", "#84CC16",
];

const WEEK_DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt"];
const MONTH_DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUserColor(userId: string | null): string | null {
  if (!userId) return null;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

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
    leadUserId: string | null;
    isMyOrder: boolean;
    dayOrder: number | null;
    note: string | null;
  };
}

interface UserOption { id: string; firstName: string; lastName: string; }

interface SimpleTask {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  assignedUserId: string | null;
  assignedUser: { id: string; firstName: string; lastName: string } | null;
  isCompleted: boolean;
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

  const { type, priority, isCritical, clientName, leadName, leadUserId, isMyOrder, note, status } = order.extendedProps;
  const noteLine = getFirstLine(note);
  const userColor = getUserColor(leadUserId);
  const isOverdue = !!order.start && new Date(order.start) < new Date() && !["ZAKONCZONE", "ANULOWANE"].includes(status);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ orderId: order.id, scheduledAt: order.start }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "relative rounded-md border-l-4 bg-white border border-gray-100 px-2.5 py-2 text-xs cursor-grab select-none transition-all active:cursor-grabbing",
        PRIORITY_BORDER[priority] ?? "border-l-gray-300",
        isReordering && "ring-2 ring-red-800 shadow-md",
        isCritical && "bg-red-50",
        isOverdue && "ring-1 ring-red-400 border-red-200",
        !isMyOrder && "opacity-70"
      )}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onClick={handleClick}
    >
      <div className="flex items-start gap-1.5">
        {isCritical && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />}
        {isOverdue && !isCritical && <Clock className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />}
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
      {leadName && (
        <p className="mt-0.5 text-gray-400 truncate pl-0.5 flex items-center gap-1">
          {userColor && (
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: userColor }} />
          )}
          {!isMyOrder && leadName}
        </p>
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
  const { data: session } = useSession();

  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Calendar view filter: "mine" | "all" | userId
  const canManage = isAdmin(session?.user) || canDo(session?.user, "calendar:view_all");
  const [calendarUserId, setCalendarUserId] = useState<string>("mine");

  const resolvedUserId =
    calendarUserId === "mine" ? (session?.user?.id ?? "") :
    calendarUserId === "all" ? "" :
    calendarUserId;

  // Fetch users for filter select (admin/manager only)
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const r = await fetch("/api/users?limit=100&status=ACTIVE");
      return r.json();
    },
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
  });
  const allUsers: UserOption[] = usersData?.data ?? [];

  // Week bounds
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  // Month grid
  const monthGridDays = buildMonthGrid(currentDate);
  const gridStart = monthGridDays[0];
  const gridEnd = monthGridDays[monthGridDays.length - 1];

  // Query range
  const from = view === "week" ? weekStart.toISOString() : gridStart.toISOString();
  const to = view === "week" ? weekEnd.toISOString() : gridEnd.toISOString();

  const calendarUrl = resolvedUserId
    ? `/api/calendar?from=${from}&to=${to}&userId=${resolvedUserId}`
    : `/api/calendar?from=${from}&to=${to}`;

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", view, from, resolvedUserId],
    queryFn: async () => {
      const r = await fetch(calendarUrl);
      return r.json();
    },
    staleTime: 30_000,
    enabled: !!session,
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

  const rescheduleMutation = useMutation({
    mutationFn: async ({ orderId, scheduledAt }: { orderId: string; scheduledAt: string }) => {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!r.ok) throw new Error("Błąd");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Termin zmieniony");
    },
    onError: () => toast.error("Błąd zmiany terminu"),
  });

  const allOrders: CalendarOrder[] = data?.data ?? [];

  // Simple tasks for current week
  const { data: simpleTasksData } = useQuery({
    queryKey: ["simple-tasks-calendar", from, resolvedUserId],
    queryFn: async () => {
      const userId = resolvedUserId || session?.user?.id;
      const weekEnd = addDays(weekStart, 6);
      const url = `/api/simple-tasks?date=${format(weekStart, "yyyy-MM-dd")}&to=${format(weekEnd, "yyyy-MM-dd")}&userId=${userId ?? ""}`;
      const r = await fetch(url);
      return r.json();
    },
    enabled: view === "week" && !!session,
    staleTime: 30_000,
  });
  const allSimpleTasks: SimpleTask[] = simpleTasksData?.data ?? [];

  function simpleTasksForDay(day: Date): SimpleTask[] {
    return allSimpleTasks.filter((t) => t.date && isSameDay(new Date(t.date), day));
  }

  const completeSimpleTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/simple-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!r.ok) throw new Error("Błąd");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simple-tasks-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Zadanie wykonane");
    },
  });

  function ordersForDay(day: Date): CalendarOrder[] {
    return sortOrders(
      allOrders.filter((o) => o.start && isSameDay(new Date(o.start), day))
    );
  }

  function handleDropToDay(orderId: string, originalScheduledAt: string | null, targetDay: Date) {
    const newDateTime = new Date(targetDay);
    if (originalScheduledAt) {
      const orig = new Date(originalScheduledAt);
      newDateTime.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    } else {
      newDateTime.setHours(8, 0, 0, 0);
    }
    rescheduleMutation.mutate({ orderId, scheduledAt: newDateTime.toISOString() });
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
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* View filter — admin/manager only */}
          {canManage && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setCalendarUserId("mine")}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  calendarUserId === "mine" ? "bg-red-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                Moje
              </button>
              <button
                onClick={() => setCalendarUserId("all")}
                className={cn(
                  "px-3 py-1.5 transition-colors border-l border-gray-200",
                  calendarUserId === "all" ? "bg-red-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                Wszyscy
              </button>
              {allUsers.length > 0 && (
                <div className="border-l border-gray-200">
                  <Select
                    value={!["mine", "all"].includes(calendarUserId) ? calendarUserId : ""}
                    onValueChange={(v) => v && setCalendarUserId(v)}
                  >
                    <SelectTrigger className="h-full border-0 rounded-none text-xs px-2 w-32 focus:ring-0">
                      <SelectValue placeholder="Serwisant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
                const dayKey = day.toISOString();
                const isDragOver = dragOverDay === dayKey;

                return (
                  <div
                    key={dayKey}
                    className="flex flex-col min-w-0"
                    onDragOver={(e) => { e.preventDefault(); setDragOverDay(dayKey); }}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverDay(null);
                      try {
                        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                        handleDropToDay(data.orderId, data.scheduledAt, day);
                      } catch {}
                    }}
                  >
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

                    {/* Orders drop zone */}
                    <div
                      className={cn(
                        "flex-1 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] rounded-lg transition-colors",
                        isDragOver && "bg-blue-50 ring-2 ring-blue-300 ring-dashed"
                      )}
                    >
                      {isLoading ? (
                        <div className="space-y-1">
                          {[1, 2].map((n) => (
                            <div key={n} className="h-12 bg-gray-100 rounded animate-pulse" />
                          ))}
                        </div>
                      ) : dayOrders.length === 0 ? (
                        <div
                          className={cn(
                            "h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors",
                            isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                          )}
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
                      {/* Simple tasks */}
                      {simpleTasksForDay(day).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600 group"
                        >
                          <button
                            onClick={() => completeSimpleTaskMutation.mutate(task.id)}
                            className="shrink-0 text-gray-400 hover:text-green-500 transition-colors"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </button>
                          <span className="flex-1 truncate">{task.title}</span>
                          {task.assignedUser && (
                            <span className="text-gray-400 shrink-0">{task.assignedUser.firstName}</span>
                          )}
                        </div>
                      ))}
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
            {/* User color legend */}
            {calendarUserId === "all" && allUsers.slice(0, 5).map((u) => {
              const color = getUserColor(u.id);
              return color ? (
                <span key={u.id} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  {u.firstName}
                </span>
              ) : null;
            })}
            <span className="ml-auto italic text-gray-400">
              Przeciągnij zlecenie aby zmienić dzień · przytrzymaj aby zmienić kolejność
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
                        dayOrders.slice(0, 3).map((order) => {
                          const color = getUserColor(order.extendedProps.leadUserId);
                          return (
                            <div
                              key={order.id}
                              onClick={() => router.push(`/orders/${order.id}`)}
                              className={cn(
                                "text-[10px] truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80 flex items-center gap-1",
                                TYPE_COLORS[order.extendedProps.type] ?? "bg-gray-100 text-gray-700"
                              )}
                            >
                              {color && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              )}
                              {order.title}
                            </div>
                          );
                        })}
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
                    {/* Colored dots per order (user color) */}
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center max-w-[22px]">
                      {dayOrders.slice(0, 4).map((o) => {
                        const color = getUserColor(o.extendedProps.leadUserId);
                        return (
                          <span
                            key={o.id}
                            className={cn("w-1.5 h-1.5 rounded-sm", !color && (TYPE_DOT[o.extendedProps.type] ?? "bg-gray-400"))}
                            style={color ? { backgroundColor: color } : undefined}
                          />
                        );
                      })}
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
                    {ordersForDay(selectedDay).map((order) => {
                      const color = getUserColor(order.extendedProps.leadUserId);
                      return (
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
                          {order.extendedProps.leadName && (
                            <p className="text-gray-400 truncate flex items-center gap-1">
                              {color && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                              {order.extendedProps.leadName}
                            </p>
                          )}
                        </div>
                      );
                    })}
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
