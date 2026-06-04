import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const logs = await prisma.inquiryContactLog.findMany({
    where: { inquiryId: id },
    orderBy: { contactDate: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { contactType, contactDate, note, outcome, isAboutQuote } = body;

  if (!contactType) {
    return NextResponse.json({ error: "contactType jest wymagany" }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const log = await prisma.inquiryContactLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      contactType,
      contactDate: contactDate ? new Date(contactDate) : new Date(),
      contactPerson: actorLabel,
      note: note ?? null,
      outcome: outcome ?? null,
      isAboutQuote: isAboutQuote ?? false,
    },
  });

  const CONTACT_LABELS: Record<string, string> = {
    TELEFON: "Telefon",
    EMAIL: "Email",
    SMS: "SMS",
    SPOTKANIE: "Spotkanie",
    INNE: "Inny kontakt",
  };

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "CONTACT_LOG",
      description: `Zarejestrowano kontakt: ${CONTACT_LABELS[contactType] ?? contactType}${outcome ? ` — ${outcome}` : ""}`,
    },
  });

  return NextResponse.json(log, { status: 201 });
}
