"use client";

import { useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";

const PRIORITY_BG: Record<string, string> = {
  NISKI: "#94a3b8",
  NORMALNY: "#3b82f6",
  WYSOKI: "#f97316",
  KRYTYCZNY: "#ef4444",
};

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Aw",
  KONSERWACJA: "Ko",
  MONTAZ: "Mo",
  MODERNIZACJA: "Md",
  INNE: "In",
};

function EventContent({ eventInfo }: { eventInfo: EventContentArg }) {
  const { isCritical, clientName, type } = eventInfo.event.extendedProps as {
    isCritical: boolean;
    clientName: string;
    type: string;
  };

  return (
    <div className="px-1 py-0.5 text-white text-xs overflow-hidden leading-tight">
      <div className="flex items-center gap-1">
        {isCritical && <span className="text-red-200">●</span>}
        <span className="font-semibold">{TYPE_LABELS[type] ?? type}</span>
        <span className="truncate opacity-90">{eventInfo.event.title}</span>
      </div>
      {clientName && <div className="truncate opacity-75">{clientName}</div>}
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const { data } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => {
      const r = await fetch("/api/calendar");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const events = (data?.data ?? []).map((e: {
    id: string;
    title: string;
    start: string;
    end?: string;
    extendedProps: { priority: string; isCritical: boolean; clientName: string; type: string };
  }) => ({
    ...e,
    backgroundColor: PRIORITY_BG[e.extendedProps.priority] ?? "#3b82f6",
    borderColor: e.extendedProps.isCritical ? "#dc2626" : "transparent",
    borderWidth: e.extendedProps.isCritical ? 2 : 0,
  }));

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      router.push(`/orders/${info.event.id}`);
    },
    [router]
  );

  const handleDateClick = useCallback(
    (info: { dateStr: string }) => {
      router.push(`/orders/new?scheduledAt=${info.dateStr}`);
    },
    [router]
  );

  return (
    <div className="p-4 md:p-6 h-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Kalendarz</h1>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-600">
        {Object.entries(PRIORITY_BG).map(([k, color]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
            {k.charAt(0) + k.slice(1).toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-4">
          <span className="h-3 w-3 rounded-sm inline-block bg-red-400 ring-2 ring-red-600" />
          Krytyczna awaria
        </span>
      </div>

      <div className="bg-white rounded-xl border p-2 md:p-4 [&_.fc]:text-sm">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={plLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventContent={(eventInfo) => <EventContent eventInfo={eventInfo} />}
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={true}
          nowIndicator={true}
          height="auto"
          businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>
    </div>
  );
}
