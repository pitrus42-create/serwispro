import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET — sprawdź duplikaty przed konwersją
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  if (inquiry.convertedToClient) {
    return NextResponse.json({ alreadyConverted: true, clientId: inquiry.clientId });
  }

  // Szukaj duplikatów
  const orConditions: object[] = [];
  if (inquiry.contactEmail) orConditions.push({ email: inquiry.contactEmail });
  if (inquiry.contactPhone) orConditions.push({ phone: inquiry.contactPhone });
  if (inquiry.nip) orConditions.push({ nip: inquiry.nip });

  const duplicates = orConditions.length > 0
    ? await prisma.client.findMany({
        where: { OR: orConditions, isActive: true },
        select: { id: true, name: true, email: true, phone: true, nip: true, city: true },
        take: 5,
      })
    : [];

  return NextResponse.json({ hasDuplicates: duplicates.length > 0, duplicates });
}

// POST — konwertuj zapytanie na klienta
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  // existingClientId — połącz z istniejącym klientem
  // force: true — utwórz nowego mimo duplikatów
  const { existingClientId, force } = body;

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  let clientId: string;

  if (existingClientId) {
    // Połącz z istniejącym klientem
    clientId = existingClientId;
  } else {
    // Sprawdź duplikaty (chyba że force)
    if (!force) {
      const orConditions: object[] = [];
      if (inquiry.contactEmail) orConditions.push({ email: inquiry.contactEmail });
      if (inquiry.contactPhone) orConditions.push({ phone: inquiry.contactPhone });
      if (inquiry.nip) orConditions.push({ nip: inquiry.nip });

      if (orConditions.length > 0) {
        const dups = await prisma.client.findMany({
          where: { OR: orConditions, isActive: true },
          select: { id: true, name: true, email: true, phone: true },
          take: 5,
        });
        if (dups.length > 0) {
          return NextResponse.json({ hasDuplicates: true, duplicates: dups }, { status: 409 });
        }
      }
    }

    // Utwórz nowego klienta
    const newClient = await prisma.client.create({
      data: {
        type: inquiry.companyName ? "company" : "individual",
        name: inquiry.companyName ?? inquiry.contactName,
        nip: inquiry.nip ?? null,
        phone: inquiry.contactPhone ?? null,
        email: inquiry.contactEmail ?? null,
        address: inquiry.investmentAddress ?? null,
        city: inquiry.investmentCity ?? null,
        postalCode: inquiry.investmentPostal ?? null,
        notes: `Klient pozyskany z zapytania ofertowego ${inquiry.inquiryNumber}`,
      },
    });
    clientId = newClient.id;
  }

  // Zaktualizuj zapytanie
  await prisma.inquiry.update({
    where: { id },
    data: {
      clientId,
      convertedToClient: true,
      status: "PRZEKSZTALCONE",
    },
  });

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "CONVERTED",
      description: existingClientId
        ? `Połączono z istniejącym klientem (ID: ${clientId})`
        : `Utworzono nowego klienta w bazie (ID: ${clientId})`,
      newValue: clientId,
    },
  });

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return NextResponse.json({ success: true, clientId, client }, { status: 200 });
}
