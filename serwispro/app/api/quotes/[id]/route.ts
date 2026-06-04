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

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { packageType: "asc" },
        include: { items: { orderBy: { id: "asc" } } },
      },
      acceptance: true,
      inquiry: {
        select: {
          id: true,
          inquiryNumber: true,
          serviceType: true,
          contactName: true,
          formAnswers: true,
          aestheticsScale: true,
          priorities: true,
          expectedDate: true,
        },
      },
    },
  });

  if (!quote) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  return NextResponse.json(quote);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    status, validUntil, internalNotes, summary, conditions,
    clientName, clientPhone, clientEmail, clientCompany, clientNip,
    investmentAddress, serviceType,
  } = body;

  const updated = await prisma.quote.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      ...(summary !== undefined ? { summary } : {}),
      ...(conditions !== undefined ? { conditions } : {}),
      ...(clientName !== undefined ? { clientName } : {}),
      ...(clientPhone !== undefined ? { clientPhone } : {}),
      ...(clientEmail !== undefined ? { clientEmail } : {}),
      ...(clientCompany !== undefined ? { clientCompany } : {}),
      ...(clientNip !== undefined ? { clientNip } : {}),
      ...(investmentAddress !== undefined ? { investmentAddress } : {}),
      ...(serviceType !== undefined ? { serviceType } : {}),
    },
    include: {
      packages: { include: { items: true } },
      acceptance: true,
    },
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
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
