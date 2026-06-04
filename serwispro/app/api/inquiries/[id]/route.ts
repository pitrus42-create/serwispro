import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeInquiry } from "@/lib/inquiry-analysis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { addedAt: "asc" } },
      changeLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      contactLogs: { orderBy: { contactDate: "desc" } },
      quotes: {
        orderBy: { createdAt: "desc" },
        include: { packages: true, acceptance: true },
      },
      client: { select: { id: true, name: true } },
    },
  });

  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  return NextResponse.json(inquiry);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const existing = await prisma.inquiry.findUnique({
    where: { id },
    include: { _count: { select: { photos: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const {
    serviceType, source, contactName, contactPhone, contactEmail,
    companyName, nip, investmentAddress, investmentCity, investmentPostal,
    formAnswers, aestheticsScale, priorities, expectedDate, budgetRange, internalNotes,
  } = body;

  const updatedFields: string[] = [];
  if (serviceType && serviceType !== existing.serviceType) updatedFields.push("typ usługi");
  if (contactName && contactName !== existing.contactName) updatedFields.push("imię/nazwisko");
  if (contactPhone !== undefined && contactPhone !== existing.contactPhone) updatedFields.push("telefon");
  if (contactEmail !== undefined && contactEmail !== existing.contactEmail) updatedFields.push("email");
  if (investmentCity !== undefined && investmentCity !== existing.investmentCity) updatedFields.push("miasto");
  if (investmentAddress !== undefined && investmentAddress !== existing.investmentAddress) updatedFields.push("adres");
  if (internalNotes !== undefined && internalNotes !== existing.internalNotes) updatedFields.push("notatki wewnętrzne");

  const newFormAnswers = formAnswers !== undefined ? JSON.stringify(formAnswers) : existing.formAnswers;
  const newPriorities = priorities !== undefined ? JSON.stringify(priorities) : existing.priorities;
  const newAestheticsScale = aestheticsScale !== undefined
    ? (aestheticsScale ? parseInt(aestheticsScale) : null)
    : existing.aestheticsScale;

  const analysis = analyzeInquiry({
    serviceType: serviceType ?? existing.serviceType,
    aestheticsScale: newAestheticsScale,
    priorities: newPriorities,
    expectedDate: expectedDate !== undefined ? expectedDate : existing.expectedDate,
    formAnswers: newFormAnswers,
    contactPhone: contactPhone !== undefined ? contactPhone : existing.contactPhone,
    contactEmail: contactEmail !== undefined ? contactEmail : existing.contactEmail,
    investmentAddress: investmentAddress !== undefined ? investmentAddress : existing.investmentAddress,
    investmentCity: investmentCity !== undefined ? investmentCity : existing.investmentCity,
    _count: { photos: existing._count.photos },
  });

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(serviceType !== undefined ? { serviceType } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(contactName !== undefined ? { contactName } : {}),
      ...(contactPhone !== undefined ? { contactPhone } : {}),
      ...(contactEmail !== undefined ? { contactEmail } : {}),
      ...(companyName !== undefined ? { companyName } : {}),
      ...(nip !== undefined ? { nip } : {}),
      ...(investmentAddress !== undefined ? { investmentAddress } : {}),
      ...(investmentCity !== undefined ? { investmentCity } : {}),
      ...(investmentPostal !== undefined ? { investmentPostal } : {}),
      ...(formAnswers !== undefined ? { formAnswers: newFormAnswers } : {}),
      ...(aestheticsScale !== undefined ? { aestheticsScale: newAestheticsScale } : {}),
      ...(priorities !== undefined ? { priorities: newPriorities } : {}),
      ...(expectedDate !== undefined ? { expectedDate } : {}),
      ...(budgetRange !== undefined ? { budgetRange } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      tags: JSON.stringify(analysis.tags),
      autoAnalysis: JSON.stringify(analysis),
    },
  });

  if (updatedFields.length > 0) {
    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId: id,
        userId: session.user.id,
        actorLabel,
        changeType: "FIELD_UPDATE",
        description: `Zaktualizowano: ${updatedFields.join(", ")}`,
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  await prisma.inquiry.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: session.user.id },
  });

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "DELETED",
      description: `Zapytanie przeniesione do usuniętych przez ${actorLabel}`,
    },
  });

  return NextResponse.json({ success: true });
}
