import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/order-number";
import { NextRequest, NextResponse } from "next/server";

type QuoteType = "three_packages" | "two_packages" | "single_variant";

const PACKAGE_PRESETS: Record<QuoteType, Array<{ packageType: string; name: string; description: string; isRecommended: boolean }>> = {
  three_packages: [
    { packageType: "MINIMUM",  name: "Pakiet Minimum",  description: "Podstawowy system spełniający wymagania w budżetowej cenie.", isRecommended: false },
    { packageType: "STANDARD", name: "Pakiet Standard", description: "Rekomendowany wariant — najlepszy stosunek ceny do jakości.",   isRecommended: true  },
    { packageType: "PRO",      name: "Pakiet Pro",      description: "Profesjonalne rozwiązanie z pełną konfiguracją i estetycznym montażem.", isRecommended: false },
  ],
  two_packages: [
    { packageType: "MINIMUM",  name: "Wariant Ekonomiczny", description: "Rozwiązanie spełniające podstawowe wymagania w rozsądnej cenie.", isRecommended: false },
    { packageType: "PRO",      name: "Wariant Premium",     description: "Profesjonalne rozwiązanie z pełną konfiguracją i lepszym sprzętem.", isRecommended: true  },
  ],
  single_variant: [
    { packageType: "STANDARD", name: "Rekomendowane rozwiązanie", description: "Propozycja dopasowana do Twoich potrzeb i lokalizacji.", isRecommended: true },
  ],
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quotes = await prisma.quote.findMany({
    where: { inquiryId: id },
    orderBy: { createdAt: "desc" },
    include: {
      packages: { include: { items: true } },
      acceptance: true,
    },
  });

  return NextResponse.json(quotes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const quoteType: QuoteType = (body.quoteType as QuoteType) || "three_packages";

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono zapytania" }, { status: 404 });

  const quoteNumber = await generateQuoteNumber();
  const packages = PACKAGE_PRESETS[quoteType] ?? PACKAGE_PRESETS.three_packages;

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      inquiryId: id,
      status: "ROBOCZA",
      quoteType,
      clientName: inquiry.contactName,
      clientPhone: inquiry.contactPhone,
      clientEmail: inquiry.contactEmail,
      clientCompany: inquiry.companyName,
      clientNip: inquiry.nip,
      investmentAddress: [inquiry.investmentAddress, inquiry.investmentPostal, inquiry.investmentCity]
        .filter(Boolean).join(", ") || null,
      serviceType: inquiry.serviceType,
      createdBy: session.user.id,
      packages: { create: packages },
    },
    include: { packages: true },
  });

  await prisma.inquiry.update({
    where: { id },
    data: { status: "WYCENA_PRZYGOTOWANA" },
  });

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel: `${session.user.firstName} ${session.user.lastName}`,
      changeType: "STATUS_CHANGE",
      description: `Utworzono wycenę ${quoteNumber} (tryb: ${quoteType})`,
      newValue: quote.id,
    },
  });

  return NextResponse.json(quote, { status: 201 });
}
