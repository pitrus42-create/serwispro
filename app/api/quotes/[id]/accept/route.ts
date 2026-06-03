import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const ACCEPTANCE_TYPE_LABELS: Record<string, string> = {
  TELEFON:    "Telefonicznie",
  EMAIL:      "Emailem",
  OSOBISCIE:  "Osobiście",
  INNE:       "Inny sposób",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { acceptedPackage, acceptanceType, note, acceptedAt } = body;

  if (!acceptedPackage || !acceptanceType) {
    return NextResponse.json({ error: "acceptedPackage i acceptanceType są wymagane" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { inquiry: { select: { id: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const statusMap: Record<string, string> = {
    TELEFON:   "ZAAKCEPTOWANA_TEL",
    EMAIL:     "ZAAKCEPTOWANA_MAIL",
    OSOBISCIE: "ZAAKCEPTOWANA_TEL",
    INNE:      "ZAAKCEPTOWANA_TEL",
  };
  const newStatus = statusMap[acceptanceType] ?? "ZAAKCEPTOWANA_TEL";
  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;
  const acceptanceDate = acceptedAt ? new Date(acceptedAt) : new Date();

  // Utwórz lub zaktualizuj akceptację
  await prisma.quoteAcceptance.upsert({
    where: { quoteId: id },
    create: {
      quoteId: id,
      acceptedPackage,
      acceptanceType,
      acceptedAt: acceptanceDate,
      recordedBy: session.user.id,
      note: note ?? null,
    },
    update: {
      acceptedPackage,
      acceptanceType,
      acceptedAt: acceptanceDate,
      recordedBy: session.user.id,
      note: note ?? null,
    },
  });

  // Aktualizuj status wyceny
  await prisma.quote.update({
    where: { id },
    data: { status: newStatus },
  });

  // Aktualizuj powiązane zapytanie
  if (quote.inquiry) {
    await prisma.inquiry.update({
      where: { id: quote.inquiry.id },
      data: { status: "ZAAKCEPTOWANE" },
    });

    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId: quote.inquiry.id,
        userId: session.user.id,
        actorLabel,
        changeType: "STATUS_CHANGE",
        description: `Wycena ${quote.quoteNumber} zaakceptowana ${ACCEPTANCE_TYPE_LABELS[acceptanceType] ?? acceptanceType} — Pakiet ${acceptedPackage}`,
        fieldName: "status",
        oldValue: "OCZEKUJE_NA_DECYZJE",
        newValue: "ZAAKCEPTOWANE",
      },
    });
  }

  const updated = await prisma.quote.findUnique({
    where: { id },
    include: { packages: { include: { items: true } }, acceptance: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.quoteAcceptance.deleteMany({ where: { quoteId: id } });
  await prisma.quote.update({ where: { id }, data: { status: "WYSLANA" } });

  return NextResponse.json({ success: true });
}
