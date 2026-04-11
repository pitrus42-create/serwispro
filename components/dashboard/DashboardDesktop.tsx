"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ORDER_TYPE_CONFIG } from "@/constants/colors";
import Link from "next/link";
import type { DashboardData } from "./types";

const ACTION_LABELS: Record<string, string> = {
  order_created: "utworzył zlecenie",
  status_changed: "zmienił status",
  assignment_added: "przypisał pracownika",
  note_added: "dodał notatkę",
  protocol_generated: "wygenerował protokół",
  checklist_item_checked: "odhaczył punkt checklisty",
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Critical alert banner */}
      {d.criticalAlerts > 0 && (
        <Link href="/orders?critical=true">
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse-red shadow-lg">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">
                {d.criticalAlerts}{" "}
                {d.criticalAlerts === 1
                  ? "aktywna awaria krytyczna!"
                  : "aktywne awarie krytyczne!"}
              </p>
              <p className="text-sm opacity-90">Kliknij aby zobaczyć szczegóły</p>
            </div>
            <span className="text-3xl font-black">{d.criticalAlerts}</span>
          </div>
        </Link>
      )}

      {/* Stat cards — 3-column grid */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Awarie krytyczne"
          value={d.criticalAlerts}
          icon={AlertTriangle}
          color={
            d.criticalAlerts > 0
              ? "bg-red-100 text-red-900"
              : "bg-green-100 text-green-900"
          }
          href="/orders?critical=true"
          pulse={d.criticalAlerts > 0}
          description={
            d.criticalAlerts === 0 ? "Wszystko OK ✓" : "Wymagają reakcji!"
          }
        />
        <StatCard
          title="Otwarte awarie"
          value={d.openAlerts}
          icon={Flame}
          color="bg-orange-100 text-orange-900"
          href="/orders?type=AWARIA&status=OCZEKUJACE,PRZYJETE,W_TOKU"
        />
        <StatCard
          title="Zadania dziś"
          value={d.todayOrders.length}
          icon={ClipboardList}
          color="bg-blue-100 text-blue-900"
          href="/calendar"
        />
        <StatCard
          title="Zaległe"
          value={d.overdueOrders}
          icon={Clock}
          color={
            d.overdueOrders > 0
              ? "bg-amber-100 text-amber-900"
              : "bg-gray-100 text-gray-700"
          }
          href="/orders?overdue=true"
        />
        <StatCard
          title="Wysoki priorytet"
          value={d.highPriorityOrders}
          icon={Flame}
          color="bg-purple-100 text-purple-900"
          href="/orders?priority=WYSOKI,KRYTYCZNY"
        />
        <StatCard
          title="Konserwacje do planu"
          value={d.pendingMaintenance}
          icon={Wrench}
          color="bg-teal-100 text-teal-900"
          href="/orders?type=KONSERWACJA"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Szybkie akcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-red-600 hover:bg-red-700">
              <Link href="/orders/new?type=AWARIA">
                <Zap className="w-4 h-4 mr-1.5" />
                Nowa Awaria
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders/new">
                <Plus className="w-4 h-4 mr-1.5" />
                Nowe Zlecenie
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/calendar">
                <Calendar className="w-4 h-4 mr-1.5" />
                Kalendarz
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/clients/new">
                <UserPlus className="w-4 h-4 mr-1.5" />
                Nowy klient
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/clients">
                <Users className="w-4 h-4 mr-1.5" />
                Klienci
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders">
                <ClipboardList className="w-4 h-4 mr-1.5" />
                Wszystkie zlecenia
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: tasks + activity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Today's tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Zadania na dziś</span>
              <Link
                href="/calendar"
                className="text-xs text-blue-600 font-normal"
              >
                Kalendarz →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.todayOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Brak zaplanowanych zadań na dziś
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.todayOrders.map((order) => {
                  const typeConfig =
                    ORDER_TYPE_CONFIG[
                      order.type as keyof typeof ORDER_TYPE_CONFIG
                    ];
                  const lead = order.assignments[0]?.user;
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-2 py-2.5 hover:bg-gray-50 rounded-lg px-1 transition-colors"
                      >
                        <span className="text-lg shrink-0">
                          {typeConfig?.icon ?? "📋"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {order.title ??
                              order.client?.name ??
                              order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(order.scheduledAt)}
                            {lead &&
                              ` · ${lead.firstName} ${lead.lastName}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {typeConfig?.label}
                        </Badge>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity — up to 10 items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ostatnia aktywność</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Brak aktywności
              </p>
            ) : (
              <ul className="space-y-2.5">
                {d.recentActivity.map((log) => (
                  <li key={log.id} className="flex gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div className="text-gray-600">
                      <span className="font-medium text-gray-800">
                        {log.user
                          ? `${log.user.firstName} ${log.user.lastName}`
                          : "System"}
                      </span>{" "}
                      {ACTION_LABELS[log.action] ?? log.action}
                      {log.order && (
                        <>
                          {" · "}
                          <Link
                            href="/orders"
                            className="text-blue-600 hover:underline"
                          >
                            {log.order.orderNumber}
                          </Link>
                        </>
                      )}
                      <span className="text-gray-400 ml-1.5 text-xs">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
