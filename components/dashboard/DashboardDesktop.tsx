"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  ClipboardList,
  Wrench,
  Flame,
  Zap,
  Plus,
  Calendar,
  UserPlus,
  Users,
  ChevronRight,
  CheckSquare,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ORDER_TYPE_CONFIG } from "@/constants/colors";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PersonalPanel } from "./PersonalPanel";
import { MiniCalendar } from "./MiniCalendar";
import type { DashboardData } from "./types";

const DURATION_LABELS: Record<string, string> = {
  "30min": "30 min",
  "1h": "1h",
  "2h": "2h",
  "halfday": "pół dnia",
  "fullday": "cały dzień",
  "2days": "2 dni",
  "several": "kilka dni",
};

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
  pulse,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href?: string;
  pulse?: boolean;
  description?: string;
}) {
  const inner = (
    <Card
      className={`${color} border-0 cursor-pointer hover:opacity-90 transition-opacity ${
        pulse && value > 0 ? "animate-pulse-red" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs opacity-70 mt-0.5">{description}</p>
            )}
          </div>
          <Icon className="w-8 h-8 opacity-70" />
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

export function DashboardDesktop({
  data,
}: {
  data: DashboardData;
}) {
  const d = data;
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/simple-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!r.ok) throw new Error("Błąd");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setCompletingTask(null);
    },
    onError: () => { toast.error("Błąd oznaczenia zadania"); setCompletingTask(null); },
  });

  return (
    <div className="flex gap-5 max-w-7xl mx-auto items-start">
      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

      {/* Critical alert banner */}
      {d.criticalAlerts > 0 && (
        <Link href="/orders?critical=true">
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse-red shadow-lg">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">
                {d.criticalAlerts}{" "}
                {d.criticalAlerts === 1 ? "aktywna awaria krytyczna!" : "aktywne awarie krytyczne!"}
              </p>
              <p className="text-sm opacity-90">Kliknij aby zobaczyć szczegóły</p>
            </div>
            <span className="text-3xl font-black">{d.criticalAlerts}</span>
          </div>
        </Link>
      )}

      {/* Stat cards — 3-column grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          title="Otwarte awarie"
          value={d.openAlerts}
          icon={Flame}
          color={d.openAlerts > 0 ? "bg-orange-100 text-orange-900" : "bg-gray-100 text-gray-600"}
          href="/orders?type=AWARIA&status=OCZEKUJACE,PRZYJETE,W_TOKU"
        />
        <StatCard
          title="Zadania dziś"
          value={d.todayOrders.length}
          icon={ClipboardList}
          color={d.todayOrders.length > 0 ? "bg-red-100 text-red-950" : "bg-gray-100 text-gray-600"}
          href="/calendar"
        />
        <StatCard
          title="Zaległe"
          value={d.overdueOrders}
          icon={Clock}
          color={d.overdueOrders > 0 ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-600"}
          href="/orders?overdue=true"
        />
        <StatCard
          title="Oczekujące"
          value={d.waitingOrders}
          icon={ClipboardList}
          color={d.waitingOrders > 0 ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-600"}
          href="/orders"
        />
        <StatCard
          title="Do rozliczenia"
          value={d.unsettledOrders}
          icon={CircleDollarSign}
          color={d.unsettledOrders > 0 ? "bg-purple-100 text-purple-900" : "bg-gray-100 text-gray-600"}
          href="/orders"
        />
        <StatCard
          title="Konserwacje do planu"
          value={d.pendingMaintenance}
          icon={Wrench}
          color={d.pendingMaintenance > 0 ? "bg-teal-100 text-teal-900" : "bg-gray-100 text-gray-600"}
          href="/orders?type=KONSERWACJA"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Szybkie akcje</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <Button asChild className="bg-red-600 hover:bg-red-700 h-10 justify-start">
              <Link href="/orders/new?type=AWARIA">
                <Zap className="w-4 h-4 mr-1.5 shrink-0" />
                Nowa Awaria
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start">
              <Link href="/orders/new">
                <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                Nowe Zlecenie
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start">
              <Link href="/calendar">
                <Calendar className="w-4 h-4 mr-1.5 shrink-0" />
                Kalendarz
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start">
              <Link href="/clients/new">
                <UserPlus className="w-4 h-4 mr-1.5 shrink-0" />
                Nowy klient
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start">
              <Link href="/clients">
                <Users className="w-4 h-4 mr-1.5 shrink-0" />
                Klienci
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start">
              <Link href="/orders">
                <ClipboardList className="w-4 h-4 mr-1.5 shrink-0" />
                Wszystkie zlecenia
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's tasks — full width */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              Zadania na dziś
              {(d.todayOrders.length + d.todaySimpleTasks.length) > 0 && (
                <span className="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {d.todayOrders.length + d.todaySimpleTasks.length}
                </span>
              )}
            </span>
            <Link href="/calendar" className="text-xs text-red-800 font-normal">
              Kalendarz →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">

          {/* Overdue orders — "Wymaga reakcji" */}
          {d.overdueOrdersList.length > 0 && (
            <div className="mb-4 pb-4 border-b border-red-100">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Wymaga reakcji ({d.overdueOrdersList.length})
              </p>
              <ul className="space-y-1.5">
                {d.overdueOrdersList.map((order) => {
                  const typeConfig = ORDER_TYPE_CONFIG[order.type as keyof typeof ORDER_TYPE_CONFIG];
                  const lead = order.assignments[0]?.user;
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-2 pl-3 border-l-2 border-red-400 bg-red-50 hover:bg-red-100 rounded-r-lg py-2 pr-3 transition-colors"
                      >
                        <span className="text-base shrink-0">{typeConfig?.icon ?? "📋"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {order.title ?? order.client?.name ?? order.orderNumber}
                          </p>
                          <p className="text-xs text-red-500">
                            {order.client?.name && `${order.client.name} · `}
                            {formatDateTime(order.scheduledAt)}
                            {lead && ` · ${lead.firstName} ${lead.lastName}`}
                          </p>
                        </div>
                        <Badge className="text-[10px] bg-red-100 text-red-700 border-0 shrink-0">Zaległe</Badge>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Simple tasks */}
          {d.todaySimpleTasks.length > 0 && (
            <ul className="space-y-1 mb-3 pb-3 border-b border-dashed border-gray-200">
              {d.todaySimpleTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-gray-50">
                  <button
                    onClick={() => {
                      setCompletingTask(task.id);
                      completeTaskMutation.mutate(task.id);
                    }}
                    disabled={completingTask === task.id}
                    className="shrink-0 w-4 h-4 rounded border-2 border-gray-300 hover:border-green-500 transition-colors flex items-center justify-center"
                  >
                    {completingTask === task.id && <CheckSquare className="h-3 w-3 text-green-500" />}
                  </button>
                  <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                  {task.assignedUser && (
                    <span className="text-xs text-gray-400 shrink-0">{task.assignedUser.firstName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Today's orders */}
          {d.todayOrders.length === 0 && d.todaySimpleTasks.length === 0 && d.overdueOrdersList.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Brak zaplanowanych zadań na dziś</p>
              <Link href="/calendar" className="text-xs text-red-800 hover:underline mt-1 inline-block">
                Przejdź do kalendarza →
              </Link>
            </div>
          ) : d.todayOrders.length === 0 ? null : (
            <ul className="divide-y divide-gray-100">
              {d.todayOrders.map((order) => {
                const typeConfig = ORDER_TYPE_CONFIG[order.type as keyof typeof ORDER_TYPE_CONFIG];
                const lead = order.assignments[0]?.user;
                const isPastDue = !!order.scheduledAt && new Date(order.scheduledAt) < new Date();
                const dur = order.estimatedDuration ? DURATION_LABELS[order.estimatedDuration] : null;
                return (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-2 py-3 hover:bg-gray-50 rounded-lg px-1 transition-colors"
                    >
                      <span className="text-lg shrink-0">{typeConfig?.icon ?? "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900">
                          {order.title ?? order.client?.name ?? order.orderNumber}
                        </p>
                        {(order.client?.name || order.location?.address) && (
                          <p className="text-xs text-gray-500 truncate">
                            {order.client?.name}
                            {order.location?.address ? ` · ${order.location.address}` : ""}
                          </p>
                        )}
                        <p className={`text-xs ${isPastDue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          {formatDateTime(order.scheduledAt)}
                          {lead && ` · ${lead.firstName} ${lead.lastName}`}
                          {dur && ` · ${dur}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{typeConfig?.label}</Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      </div>
      {/* ── end main content ── */}

      {/* ── Personal sidebar ──────────────────────────────────────────── */}
      <div className="w-64 shrink-0">
        <div className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden space-y-4">
          <MiniCalendar />
          <PersonalPanel />
        </div>
      </div>
    </div>
  );
}
