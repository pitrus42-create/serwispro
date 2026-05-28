import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { subDays, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, format } from "date-fns";
import { pl } from "date-fns/locale";

function parseRange(range: string | null, from: string | null, to: string | null): { start: Date; end: Date } {
  const now = new Date();
  if (from && to) return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
  switch (range) {
    case "week":     return { start: subDays(now, 7), end: now };
    case "2weeks":   return { start: subDays(now, 14), end: now };
    case "3months":  return { start: subDays(now, 90), end: now };
    case "6months":  return { start: subDays(now, 180), end: now };
    case "year":     return { start: subDays(now, 365), end: now };
    default:         return { start: subDays(now, 30), end: now }; // "month"
  }
}

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupBy = searchParams.get("groupBy") ?? "none";

  const { start, end } = parseRange(range, from, to);
  const dateFilter = { gte: start, lte: end };

  const [total, completed, active, critical, byType] = await Promise.all([
    prisma.order.count({ where: { createdAt: dateFilter } }),
    prisma.order.count({ where: { status: "ZAKONCZONE", completedAt: dateFilter } }),
    prisma.order.count({ where: { status: { in: ["PRZYJETE", "W_TOKU", "ZAPLANOWANE"] } } }),
    prisma.order.count({ where: { isCritical: true, createdAt: dateFilter } }),
    prisma.order.groupBy({ by: ["type"], where: { createdAt: dateFilter }, _count: { id: true } }),
  ]);

  // Financial aggregations on settled orders
  const settledOrders = await prisma.order.findMany({
    where: { isSettled: true, settledAt: dateFilter },
    include: {
      assignments: {
        where: { isLead: true },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
      client: { select: { id: true, name: true } },
    },
  });

  const unsettledCount = await prisma.order.count({
    where: { status: "ZAKONCZONE", isSettled: false },
  });

  const totalCost = settledOrders.reduce((s, o) => s + (o.settledCost ?? 0), 0);
  const totalRevenue = settledOrders.reduce((s, o) => s + (o.settledProfit ?? 0), 0);

  // Group breakdown
  type GroupEntry = { id: string; name: string; count: number; cost: number; revenue: number };
  const groupMap = new Map<string, GroupEntry>();

  if (groupBy === "serwisant") {
    for (const o of settledOrders) {
      const lead = o.assignments[0]?.user;
      const key = lead?.id ?? "_none";
      const name = lead ? `${lead.firstName} ${lead.lastName}` : "Nieprzypisane";
      const entry = groupMap.get(key) ?? { id: key, name, count: 0, cost: 0, revenue: 0 };
      entry.count++;
      entry.cost += o.settledCost ?? 0;
      entry.revenue += o.settledProfit ?? 0;
      groupMap.set(key, entry);
    }
  } else if (groupBy === "client") {
    for (const o of settledOrders) {
      const key = o.client?.id ?? "_none";
      const name = o.client?.name ?? "Brak klienta";
      const entry = groupMap.get(key) ?? { id: key, name, count: 0, cost: 0, revenue: 0 };
      entry.count++;
      entry.cost += o.settledCost ?? 0;
      entry.revenue += o.settledProfit ?? 0;
      groupMap.set(key, entry);
    }
  }

  // Monthly stats for last 6 months
  const now = new Date();
  const monthData: { name: string; total: number; zakonczone: number; revenue: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const date = subMonths(now, 5 - i);
    const mStart = startOfMonth(date);
    const mEnd = endOfMonth(date);
    const [monthTotal, monthCompleted, monthSettled] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: mStart, lte: mEnd } } }),
      prisma.order.count({ where: { status: "ZAKONCZONE", completedAt: { gte: mStart, lte: mEnd } } }),
      prisma.order.findMany({ where: { isSettled: true, settledAt: { gte: mStart, lte: mEnd } }, select: { settledProfit: true } }),
    ]);
    const revenue = monthSettled.reduce((s, o) => s + (o.settledProfit ?? 0), 0);
    monthData.push({ name: format(date, "MMM", { locale: pl }), total: monthTotal, zakonczone: monthCompleted, revenue });
  }

  const byTypeMap: Record<string, number> = {};
  byType.forEach((r: { type: string; _count: { id: number } }) => { byTypeMap[r.type] = r._count.id; });

  return NextResponse.json({
    data: {
      total, completed, active, critical,
      byType: byTypeMap,
      byMonth: monthData,
      finance: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProfit: Math.round((totalRevenue - totalCost) * 100) / 100,
        settledCount: settledOrders.length,
        unsettledCount,
      },
      breakdown: Array.from(groupMap.values()).sort((a, b) => b.revenue - a.revenue),
    },
  });
}
