"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  ClipboardList,
  Wrench,
  Flame,
  Plus,
  Calendar,
  UserPlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { ORDER_TYPE_CONFIG } from "@/constants/colors";
import Link from "next/link";

interface DashboardData {
  criticalAlerts: number;
  openAlerts: number;
  overdueOrders: number;
  todayOrders: { id: string; orderNumber: string; type: string; title?: string; client?: { name: string } | null; scheduledAt?: string | null; assignments: { user: { firstName: string; lastName: string } }[] }[];
  highPriorityOrders: number;
  pendingMaintenance: number;
  recentActivity: { id: string; action: string; createdAt: string; user?: { firstName: string; lastName: string } | null; order?: { orderNumber: string; type: string } | null }[];
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

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
    <Card className={`${color} border-0 cursor-pointer hover:opacity-90 transition-opacity ${pulse && value > 0 ? "animate-pulse-red" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs opacity-70 mt-0.5">{description}</p>}
          </div>
          <Icon className="w-8 h-8 opacity-70" />
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

const ACTION_LABELS: Record<string, string> = {
  order_created: "Utworzył zlecenie",
  status_changed: "Zmienił status",
  assignment_added: "Przypisał pracownika",
  note_added: "Dodał notatkę",
  protocol_generated: "Wygenerował protokół",
  checklist_item_checked: "Odhaczyło punkt checklisty",
};

export function DashboardContent() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Critical alert banner */}
      {d.criticalAlerts > 0 && (
        <Link href="/orders?critical=true">
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse-red shadow-lg">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">
                {d.criticalAlerts} aktywna awaria krytyczna!
              </p>
              <p className="text-sm opacity-90">Kliknij aby zobaczyć szczegóły</p>
            </div>
            <span className="text-3xl font-black">{d.criticalAlerts}</span>
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          title="Awarie krytyczne"
          value={d.criticalAlerts}
          icon={AlertTriangle}
          color={d.criticalAlerts > 0 ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900"}
          href="/orders?critical=true"
          pulse={d.criticalAlerts > 0}
          description={d.criticalAlerts === 0 ? "Wszystko OK ✓" : "Wymagają reakcji!"}
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
          color={d.overdueOrders > 0 ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}
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
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Zadania na dziś</span>
              <Link href="/calendar" className="text-xs text-blue-600 font-normal">
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
              <ul className="space-y-2">
                {d.todayOrders.map((order) => {
                  const typeConfig = ORDER_TYPE_CONFIG[order.type as keyof typeof ORDER_TYPE_CONFIG];
                  const lead = order.assignments[0]?.user;
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-lg">{typeConfig?.icon ?? "📋"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {order.title ?? order.client?.name ?? order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(order.scheduledAt)}
                            {lead && ` · ${lead.firstName} ${lead.lastName}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {typeConfig?.label}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ostatnia aktywność</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Brak aktywności</p>
            ) : (
              <ul className="space-y-2">
                {d.recentActivity.map((log) => (
                  <li key={log.id} className="flex gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"}
                      </span>{" "}
                      <span className="text-gray-600">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      {log.order && (
                        <>
                          {" "}
                          <Link href={`/orders`} className="text-blue-600 hover:underline">
                            {log.order.orderNumber}
                          </Link>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Szybkie akcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => router.push("/orders/new?type=AWARIA")}
              className="bg-red-600 hover:bg-red-700"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Nowa Awaria
            </Button>
            <Button
              onClick={() => router.push("/orders/new")}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nowe Zlecenie
            </Button>
            <Button
              onClick={() => router.push("/calendar")}
              variant="outline"
            >
              <Calendar className="w-4 h-4 mr-1" />
              Kalendarz
            </Button>
            <Button
              onClick={() => router.push("/clients/new")}
              variant="outline"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Nowy Klient
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
