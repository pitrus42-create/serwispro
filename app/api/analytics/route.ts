import { auth, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { pl } from "date-fns/locale";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const total = await prisma.order.count();
  const completed = await prisma.order.count({ where: { status: "ZAKONCZONE" } });
  const active = await prisma.order.count({ where: { status: { in: ["PRZYJETE", "W_TOKU", "ZAPLANOWANE"] } } });
  const critical = await prisma.order.count({ where: { isCritical: true } });
  const byType = await prisma.order.groupBy({ by: ["type"], _count: { id: true } });

  // Monthly stats for last 6 months
  const now = new Date();
  const monthData: { name: string; total: number; zakonczone: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const date = subMonths(now, 5 - i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const monthTotal = await prisma.order.count({ where: { createdAt: { gte: start, lte: end } } });
    const monthCompleted = await prisma.order.count({ where: { status: "ZAKONCZONE", completedAt: { gte: start, lte: end } } });
    monthData.push({ name: format(date, "MMM", { locale: pl }), total: monthTotal, zakonczone: monthCompleted });
  }

  const byTypeMap: Record<string, number> = {};
  byType.forEach((r: { type: string; _count: { id: number } }) => {
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
