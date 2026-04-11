"use client";

import {
  AlertTriangle,
  ClipboardList,
  Wrench,
  Zap,
  ChevronRight,
  Calendar,
  Users,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { ORDER_TYPE_CONFIG } from "@/constants/colors";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { canDo } from "@/lib/permissions";
import type { DashboardData } from "./types";

const ACTION_LABELS: Record<string, string> = {
  order_created: "utworzył zlecenie",
  status_changed: "zmienił status",
  assignment_added: "przypisał pracownika",
  note_added: "dodał notatkę",
  protocol_generated: "wygenerował protokół",
  checklist_item_checked: "odhaczył punkt checklisty",
};

const TYPE_COLORS: Record<string, string> = {
  AWARIA: "bg-red-500",
  PRZEGLAD: "bg-blue-500",
  KONSERWACJA: "bg-teal-500",
  INSTALACJA: "bg-purple-500",
  INNE: "bg-gray-400",
};

function getGreeting(firstName?: string) {
  const h = new Date().getHours();
  const salut = h < 12 ? "Dzień dobry" : h < 18 ? "Cześć" : "Dobry wieczór";
  const emoji = h < 12 ? "☀️" : h < 18 ? "👋" : "🌙";
  return `${salut}, ${firstName ?? ""}! ${emoji}`;
}

function formatShortDate() {
  return new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function DashboardMobile({
  data,
  firstName,
}: {
  data: DashboardData;
  firstName?: string;
}) {
  const { data: session } = useSession();
  const canCreateOrders = canDo(session?.user, "orders:create");
  const d = data;

  const pills = [
    { value: d.overdueOrders,        label: "Zaległe",     color: "bg-amber-100 text-amber-800",   href: "/orders?overdue=true" },
    { value: d.openAlerts,           label: "Awarie",      color: "bg-orange-100 text-orange-800",  href: "/orders?type=AWARIA&status=OCZEKUJACE,PRZYJETE,W_TOKU" },
    { value: d.highPriorityOrders,   label: "Pilne",       color: "bg-purple-100 text-purple-800",  href: "/orders?priority=WYSOKI,KRYTYCZNY" },
    { value: d.pendingMaintenance,   label: "Konserwacje", color: "bg-teal-100 text-teal-800",      href: "/orders?type=KONSERWACJA" },
    { value: d.todayOrders.length,   label: "Dziś",        color: "bg-blue-100 text-blue-800",      href: "/calendar" },
  ].filter((p) => p.value > 0);

  const allClear = pills.length === 0 && d.criticalAlerts === 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between -mt-1">
        <p className="text-base font-semibold text-gray-900">{getGreeting(firstName)}</p>
        <p className="text-xs text-gray-400 capitalize">{formatShortDate()}</p>
      </div>

      {/* Critical alert banner — full-bleed */}
      {d.criticalAlerts > 0 && (
        <Link
          href="/orders?critical=true"
          className="-mx-4 flex items-center gap-3 bg-red-600 text-white px-4 min-h-14 animate-pulse-red"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="flex-1 font-bold text-sm leading-tight">
            {d.criticalAlerts}× AWARIA KRYTYCZNA — Dotknij aby zobaczyć
          </p>
          <ChevronRight className="w-5 h-5 shrink-0 opacity-70" />
        </Link>
      )}

      {/* Smart stat pills */}
      {allClear ? (
        <p className="text-sm text-green-600 font-medium py-1">Wszystko w porządku ✓</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          {pills.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              className={`${p.color} rounded-full px-3 py-1 text-sm font-medium shrink-0 whitespace-nowrap`}
            >
              {p.label} {p.value}
            </Link>
          ))}
        </div>
      )}

      {/* Primary CTAs — only for roles with create permission */}
      {canCreateOrders && (
        <div className="flex gap-3">
          <Button asChild className="bg-red-600 hover:bg-red-700 h-12 flex-1 rounded-xl font-bold text-sm">
            <Link href="/orders/new?type=AWARIA">
              <Zap className="w-4 h-4 mr-1.5" />
              Nowa Awaria
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 flex-1 rounded-xl text-sm">
            <Link href="/orders/new">
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Nowe Zlecenie
            </Link>
          </Button>
        </div>
      )}

      {/* Today section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Moje dzisiaj
          </h2>
          <Link href="/calendar" className="text-xs text-blue-600 font-medium">
            Kalendarz →
          </Link>
        </div>

        {d.todayOrders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Brak zaplanowanych zadań na dziś
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {d.todayOrders.map((order) => {
              const typeConfig = ORDER_TYPE_CONFIG[order.type as keyof typeof ORDER_TYPE_CONFIG];
              const barColor = TYPE_COLORS[order.type] ?? "bg-gray-400";
              return (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-3 py-3 min-h-14"
                  >
                    <span className={`w-1 h-8 rounded-full shrink-0 ${barColor}`} />
                    <span className="text-xl shrink-0">{typeConfig?.icon ?? "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900">
                        {order.title ?? order.client?.name ?? order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(order.scheduledAt)}
                        {order.client?.name ? ` · ${order.client.name}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent activity — max 3 */}
      {d.recentActivity.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Ostatnia aktywność
          </h2>
          <ul className="space-y-2">
            {d.recentActivity.slice(0, 3).map((log) => (
              <li key={log.id} className="flex gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>
                  <span className="font-medium text-gray-800">
                    {log.user
                      ? `${log.user.firstName} ${log.user.lastName[0]}.`
                      : "System"}
                  </span>{" "}
                  {ACTION_LABELS[log.action] ?? log.action}
                  {log.order && (
                    <>
                      {" · "}
                      <span className="text-blue-600">{log.order.orderNumber}</span>
                    </>
                  )}
                  {" · "}
                  <span className="text-gray-400 text-xs">{formatDateTime(log.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Secondary ghost actions */}
      <div className="flex gap-2 flex-wrap pb-2">
        <Button asChild variant="ghost" size="sm" className="text-gray-600">
          <Link href="/calendar">
            <Calendar className="w-4 h-4 mr-1.5" />
            Kalendarz
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-gray-600">
          <Link href="/clients">
            <Users className="w-4 h-4 mr-1.5" />
            Klienci
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-gray-600">
          <Link href="/clients/new">
            <UserPlus className="w-4 h-4 mr-1.5" />
            Nowy klient
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-gray-600">
          <Link href="/orders">
            <Wrench className="w-4 h-4 mr-1.5" />
            Wszystkie zlecenia
          </Link>
        </Button>
      </div>
    </div>
  );
}
