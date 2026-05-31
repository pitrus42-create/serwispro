"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday,
  addMonths, subMonths,
} from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const POLISH_HOLIDAYS_2025 = [
  "2025-01-01","2025-01-06",
  "2025-04-20","2025-04-21", // Wielkanoc, Poniedziałek Wielkanocny
  "2025-05-01","2025-05-03",
  "2025-06-08","2025-06-19", // Zielone Świątki (W+49), Boże Ciało (W+60)
  "2025-08-15","2025-11-01","2025-11-11",
  "2025-12-25","2025-12-26",
];
const POLISH_HOLIDAYS_2026 = [
  "2026-01-01","2026-01-06",
  "2026-04-05","2026-04-06", // Wielkanoc 5 IV, Poniedziałek Wielkanocny
  "2026-05-01","2026-05-03",
  "2026-05-24","2026-06-04", // Zielone Świątki (W+49), Boże Ciało (W+60)
  "2026-08-15","2026-11-01","2026-11-11",
  "2026-12-25","2026-12-26",
];
const POLISH_HOLIDAYS_2027 = [
  "2027-01-01","2027-01-06",
  "2027-03-28","2027-03-29", // Wielkanoc 28 III, Poniedziałek Wielkanocny
  "2027-05-01","2027-05-03",
  "2027-05-16","2027-05-27", // Zielone Świątki (W+49), Boże Ciało (W+60)
  "2027-08-15","2027-11-01","2027-11-11",
  "2027-12-25","2027-12-26",
];
const HOLIDAYS = new Set([...POLISH_HOLIDAYS_2025, ...POLISH_HOLIDAYS_2026, ...POLISH_HOLIDAYS_2027]);

const DAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

function buildGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

interface CalendarEvent {
  id: string;
  start: string | null;
  extendedProps: { status: string };
}

export function MiniCalendar() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date());

  const from = startOfMonth(month).toISOString();
  const to = endOfMonth(month).toISOString();

  const { data } = useQuery({
    queryKey: ["mini-calendar", from],
    queryFn: async () => {
      const r = await fetch(`/api/calendar?from=${from}&to=${to}`);
      if (!r.ok) return { data: [] };
      return r.json();
    },
    staleTime: 60_000,
  });

  const events: CalendarEvent[] = data?.data ?? [];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, { count: number; hasOverdue: boolean }>();
    const now = new Date();
    events.forEach((e) => {
      if (!e.start) return;
      const key = format(new Date(e.start), "yyyy-MM-dd");
      const existing = map.get(key) ?? { count: 0, hasOverdue: false };
      const isOverdue =
        new Date(e.start) < now &&
        !["ZAKONCZONE", "ANULOWANE"].includes(e.extendedProps.status);
      map.set(key, {
        count: existing.count + 1,
        hasOverdue: existing.hasOverdue || isOverdue,
      });
    });
    return map;
  }, [events]);

  const days = buildGrid(month);

  return (
    <div className="bg-white rounded-xl border p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="Poprzedni miesiąc"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
        </button>
        <span className="text-xs font-semibold text-gray-700 capitalize">
          {format(month, "LLLL yyyy", { locale: pl })}
        </span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="Następny miesiąc"
        >
          <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={cn(
              "text-center text-[10px] font-medium pb-1",
              i >= 5 ? "text-red-400" : "text-gray-400"
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayData = eventsByDay.get(key);
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const holiday = HOLIDAYS.has(key);
          const isSpecial = weekend || holiday;

          return (
            <button
              key={key}
              onClick={() => inMonth && router.push(`/calendar?date=${key}`)}
              disabled={!inMonth}
              className={cn(
                "flex flex-col items-center justify-center py-0.5 rounded-md transition-colors",
                !inMonth && "opacity-0 pointer-events-none",
                inMonth && !today && "hover:bg-gray-100",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                  today && "bg-red-800 text-white",
                  !today && inMonth && isSpecial && "text-red-500",
                  !today && inMonth && !isSpecial && "text-gray-700",
                )}
              >
                {format(day, "d")}
              </span>
              {dayData && inMonth ? (
                <span
                  className={cn(
                    "w-1 h-1 rounded-full mt-0.5",
                    dayData.hasOverdue ? "bg-red-500" : "bg-blue-400"
                  )}
                />
              ) : (
                <span className="w-1 h-1 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
