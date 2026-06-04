"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Line, ComposedChart,
} from "recharts";
import { TrendingUp, CheckCircle, Clock, AlertTriangle, CircleDollarSign, Banknote, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { isAdmin, canDo } from "@/lib/permissions";

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria", KONSERWACJA: "Konserwacja", MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja", INNE: "Inne",
};

const PIE_COLORS = ["#ef4444", "#8B1A1A", "#22c55e", "#f97316", "#94a3b8"];

const RANGES = [
  { key: "week", label: "7 dni" },
  { key: "2weeks", label: "2 tyg." },
  { key: "month", label: "Miesiąc" },
  { key: "3months", label: "3 miesiące" },
  { key: "6months", label: "6 miesięcy" },
  { key: "year", label: "Rok" },
];

const GROUP_OPTIONS = [
  { key: "none", label: "Brak" },
  { key: "serwisant", label: "Serwisant" },
  { key: "client", label: "Klient" },
];

function FinanceCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-4", color)}>
      <Icon className="h-8 w-8 shrink-0 opacity-70" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm opacity-80">{label}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(v: number) { return v.toFixed(2).replace(".", ",") + " zł"; }

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [range, setRange] = useState("month");
  const [groupBy, setGroupBy] = useState("none");

  const canView = isAdmin(session?.user) || canDo(session?.user, "analytics:view");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", range, groupBy],
    queryFn: async () => {
      const r = await fetch(`/api/analytics?range=${range}&groupBy=${groupBy}`);
      return r.json();
    },
    enabled: !!session,
  });

  const stats = data?.data;

  if (!canView) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Brak uprawnień do podglądu analiz.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const typeData = Object.entries(stats?.byType ?? {}).map(([type, count]) => ({
    name: TYPE_LABELS[type] ?? type, value: count as number,
  }));
  const monthData: Array<{ name: string; total: number; zakonczone: number; revenue: number }> = stats?.byMonth ?? [];
  const finance = stats?.finance;
  const breakdown: Array<{ id: string; name: string; count: number; cost: number; revenue: number }> = stats?.breakdown ?? [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analizy</h1>
        <div className="flex gap-1 flex-wrap">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              className={range === r.key ? "bg-red-800 hover:bg-red-900" : ""}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-red-100">
            <TrendingUp className="h-6 w-6 text-red-800" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</p>
            <p className="text-sm text-gray-500">Zlecenia (zakres)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.completed ?? 0}</p>
            <p className="text-sm text-gray-500">Zakończone</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-amber-100">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.active ?? 0}</p>
            <p className="text-sm text-gray-500">W realizacji</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.critical ?? 0}</p>
            <p className="text-sm text-gray-500">Awarie krytyczne</p>
          </div>
        </div>
      </div>

      {/* Financial cards */}
      {finance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FinanceCard
            label="Przychód"
            value={fmt(finance.totalRevenue)}
            icon={CircleDollarSign}
            color="bg-green-50 text-green-900 border-green-200"
            sub={`${finance.settledCount} rozliczonych`}
          />
          <FinanceCard
            label="Koszt"
            value={fmt(finance.totalCost)}
            icon={Banknote}
            color="bg-orange-50 text-orange-900 border-orange-200"
          />
          <FinanceCard
            label="Zysk"
            value={fmt(finance.totalProfit)}
            icon={finance.totalProfit >= 0 ? TrendingUp : TrendingDown}
            color={finance.totalProfit >= 0 ? "bg-blue-50 text-blue-900 border-blue-200" : "bg-red-50 text-red-900 border-red-200"}
          />
          <FinanceCard
            label="Do rozliczenia"
            value={String(finance.unsettledCount)}
            icon={Clock}
            color={finance.unsettledCount > 0 ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-gray-50 text-gray-700 border-gray-200"}
            sub="zakończonych"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Zlecenia miesięcznie (ostatnie 6 mies.)</h2>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="total" fill="#8B1A1A" name="Wszystkie" />
                <Bar yAxisId="left" dataKey="zakonczone" fill="#22c55e" name="Zakończone" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} name="Przychód (zł)" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400">Brak danych</div>
          )}
        </div>

        {/* Type pie chart */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Podział według typu</h2>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {typeData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400">Brak danych</div>
          )}
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Rozliczenia według</h2>
          <div className="flex gap-1">
            {GROUP_OPTIONS.map((g) => (
              <Button
                key={g.key}
                size="sm"
                variant={groupBy === g.key ? "default" : "outline"}
                className={groupBy === g.key ? "bg-red-800 hover:bg-red-900" : ""}
                onClick={() => setGroupBy(g.key)}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>
        {breakdown.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            {groupBy === "none" ? "Wybierz grupowanie aby zobaczyć tabelę" : "Brak rozliczonych zleceń w wybranym zakresie"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">{groupBy === "serwisant" ? "Serwisant" : "Klient"}</th>
                  <th className="pb-2 pr-4 text-right">Zlecenia</th>
                  <th className="pb-2 pr-4 text-right">Przychód</th>
                  <th className="pb-2 pr-4 text-right">Koszt</th>
                  <th className="pb-2 text-right">Zysk</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => {
                  const profit = row.revenue - row.cost;
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{row.name}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-600">{row.count}</td>
                      <td className="py-2.5 pr-4 text-right text-green-700">{fmt(row.revenue)}</td>
                      <td className="py-2.5 pr-4 text-right text-orange-700">{fmt(row.cost)}</td>
                      <td className={cn("py-2.5 text-right font-semibold", profit >= 0 ? "text-blue-700" : "text-red-700")}>
                        {fmt(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
