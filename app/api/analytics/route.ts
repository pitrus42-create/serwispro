import { getAuth } from "@/lib/auth";
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

  // ── Inquiry & Quote metrics ───────────────────────────────────────────────
  const [
    inquiriesTotal,
    inquiriesNew,
    inquiriesInProgress,
    inquiriesConverted,
    quotesTotal,
    quotesSent,
    quotesAccepted,
    inquiriesByStatus,
    inquiriesByService,
    acceptedPackages,
    acceptedQuotes,
  ] = await Promise.all([
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: "NOWE" } }),
    prisma.inquiry.count({ where: { status: { in: ["W_ANALIZIE", "BRAKUJE_INFO", "GOTOWE_DO_WYCENY"] } } }),
    prisma.inquiry.count({ where: { convertedToClient: true } }),
    prisma.quote.count(),
    prisma.quote.count({ where: { status: "WYSLANA" } }),
    prisma.quote.count({ where: { status: { in: ["ZAAKCEPTOWANA_TEL", "ZAAKCEPTOWANA_MAIL"] } } }),
    prisma.inquiry.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.inquiry.groupBy({ by: ["serviceType"], _count: { id: true } }),
    prisma.quoteAcceptance.groupBy({ by: ["acceptedPackage"], _count: { id: true } }),
    prisma.quote.findMany({
      where: { status: { in: ["ZAAKCEPTOWANA_TEL", "ZAAKCEPTOWANA_MAIL"] } },
      include: { packages: { select: { grossTotal: true } } },
      take: 100,
    }),
  ]);

  // Konwersja zapytanie → klient
  const inquiryToClientRate = inquiriesTotal > 0
    ? Math.round((inquiriesConverted / inquiriesTotal) * 100)
    : 0;

  // Konwersja wycena → akceptacja
  const quoteAcceptanceRate = quotesTotal > 0
    ? Math.round((quotesAccepted / quotesTotal) * 100)
    : 0;

  // Średnia wartość zaakceptowanej wyceny (max pakiet z każdej)
  const acceptedValues = acceptedQuotes.map(q => Math.max(...q.packages.map(p => p.grossTotal), 0));
  const avgAcceptedValue = acceptedValues.length > 0
    ? acceptedValues.reduce((s, v) => s + v, 0) / acceptedValues.length
    : 0;
  const sumAcceptedValue = acceptedValues.reduce((s, v) => s + v, 0);

  const inquiriesByStatusMap: Record<string, number> = {};
  inquiriesByStatus.forEach(r => { inquiriesByStatusMap[r.status] = r._count.id; });

  const inquiriesByServiceMap: Record<string, number> = {};
  inquiriesByService.forEach(r => { inquiriesByServiceMap[r.serviceType] = r._count.id; });

  const acceptedPackagesMap: Record<string, number> = {};
  acceptedPackages.forEach(r => { acceptedPackagesMap[r.acceptedPackage] = r._count.id; });

  return NextResponse.json({
    data: {
      // Zlecenia (dotychczasowe)
      total, completed, active, critical,
      byType: byTypeMap, byMonth: monthData,
      // Zapytania ofertowe
      inquiries: {
        total: inquiriesTotal,
        new: inquiriesNew,
        inProgress: inquiriesInProgress,
        converted: inquiriesConverted,
        inquiryToClientRate,
        byStatus: inquiriesByStatusMap,
        byService: inquiriesByServiceMap,
      },
      // Wyceny
      quotes: {
        total: quotesTotal,
        sent: quotesSent,
        accepted: quotesAccepted,
        quoteAcceptanceRate,
        avgAcceptedValue: Math.round(avgAcceptedValue),
        sumAcceptedValue: Math.round(sumAcceptedValue),
        acceptedPackages: acceptedPackagesMap,
      },
    },
  });
}
