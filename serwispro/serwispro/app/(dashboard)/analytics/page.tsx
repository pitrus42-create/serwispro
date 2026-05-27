"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, CheckCircle, Clock, AlertTriangle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

const PIE_COLORS = ["#ef4444", "#8B1A1A", "#22c55e", "#f97316", "#94a3b8"];

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCard) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const r = await fetch("/api/analytics");
      return r.json();
    },
  });

  const stats = data?.data;

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
    name: TYPE_LABELS[type] ?? type,
    value: count as number,
  }));

  const monthData: Array<{ name: string; total: number; zakonczone: number }> = stats?.byMonth ?? [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analizy</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Zlecenia ogółem"
          value={stats?.total ?? 0}
          icon={<TrendingUp className="h-6 w-6 text-red-800" />}
          color="bg-red-100"
        />
        <StatCard
          label="Zakończone"
          value={stats?.completed ?? 0}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <StatCard
          label="W realizacji"
          value={stats?.active ?? 0}
          icon={<Clock className="h-6 w-6 text-amber-600" />}
          color="bg-amber-100"
        />
        <StatCard
          label="Awarie krytyczne"
          value={stats?.critical ?? 0}
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          color="bg-red-100"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Zlecenia miesięcznie (ostatnie 6 mies.)</h2>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#8B1A1A" name="Wszystkie" />
                <Bar dataKey="zakonczone" fill="#22c55e" name="Zakończone" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400">
              Brak danych
            </div>
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
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
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
            <div className="h-52 flex items-center justify-center text-gray-400">
              Brak danych
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
