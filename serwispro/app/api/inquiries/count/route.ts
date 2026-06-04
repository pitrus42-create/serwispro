import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const ACTIVE_STATUSES = [
  "NOWE", "W_ANALIZIE", "BRAKUJE_INFO", "GOTOWE_DO_WYCENY",
  "WYCENA_PRZYGOTOWANA", "WYCENA_WYSLANA", "OCZEKUJE_NA_DECYZJE",
  "ZAAKCEPTOWANE", "ZAPLANOWANO_MONTAZ",
];

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseWhere = { deletedAt: null, archivedAt: null };

  const [active, newCount, toQuote, waitingDecision] = await Promise.all([
    prisma.inquiry.count({ where: { ...baseWhere, status: { in: ACTIVE_STATUSES } } }),
    prisma.inquiry.count({ where: { ...baseWhere, status: "NOWE" } }),
    prisma.inquiry.count({ where: { ...baseWhere, status: "GOTOWE_DO_WYCENY" } }),
    prisma.inquiry.count({ where: { ...baseWhere, status: "OCZEKUJE_NA_DECYZJE" } }),
  ]);

  return NextResponse.json({ active, new: newCount, toQuote, waitingDecision });
}
