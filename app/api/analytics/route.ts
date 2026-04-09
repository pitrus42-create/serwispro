import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { pl } from "date-fns/locale";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [total, completed, active, critical, byType] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "ZAKONCZONE" } }),
    prisma.order.count({ where: { status: { in: ["PRZYJETE", "W_TOKU", "ZAPLANOWANE"] } } }),
    prisma.order.count({ where: { isCritical: true } }),
    prisma.order.groupBy({ by: ["type"], _count: { id: true } }),
  ]);

  // Monthly stats for last 6 months
  const now = new Date();
  const monthData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      return Promise.all([
        prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.order.count({
          where: { status: "ZAKONCZONE", completedAt: { gte: start, lte: end } },
        }),
      ]).then(([monthTotal, monthCompleted]) => ({
        name: format(date, "MMM", { locale: pl }),
        total: monthTotal,
        zakonczone: monthCompleted,
      }));
    })
  );

  const byTypeMap: Record<string, number> = {};
  byType.forEach((r) => {
    byTypeMap[r.type] = r._count.id;
  });

  return NextResponse.json({
    data: {
      total,
      completed,
      active,
      critical,
      byType: byTypeMap,
      byMonth: monthData,
    },
  });
}
