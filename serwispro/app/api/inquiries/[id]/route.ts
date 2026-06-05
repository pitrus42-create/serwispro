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

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const {
    serviceType,
    source,
    contactName,
    contactPhone,
    contactEmail,
    companyName,
    nip,
    investmentAddress,
    investmentCity,
    investmentPostal,
    formAnswers,
    aestheticsScale,
    priorities,
    expectedDate,
    budgetRange,
    internalNotes,
  } = body;

  const updatedFields: string[] = [];
  if (serviceType && serviceType !== existing.serviceType) updatedFields.push("typ usługi");
  if (contactName && contactName !== existing.contactName) updatedFields.push("imię/nazwisko");
  if (contactPhone !== undefined && contactPhone !== existing.contactPhone) updatedFields.push("telefon");
  if (contactEmail !== undefined && contactEmail !== existing.contactEmail) updatedFields.push("email");
  if (internalNotes !== undefined && internalNotes !== existing.internalNotes) updatedFields.push("notatki wewnętrzne");

  const mergedServiceType = serviceType ?? existing.serviceType;
  const mergedFormAnswers = formAnswers !== undefined ? JSON.stringify(formAnswers) : existing.formAnswers;
  const mergedPriorities = priorities !== undefined ? JSON.stringify(priorities) : existing.priorities;
  const mergedScale = aestheticsScale !== undefined ? (aestheticsScale ? parseInt(aestheticsScale) : null) : existing.aestheticsScale;
  const mergedExpectedDate = expectedDate !== undefined ? expectedDate : existing.expectedDate;
  const mergedBudgetRange = budgetRange !== undefined ? budgetRange : existing.budgetRange;
  const mergedInternalNotes = internalNotes !== undefined ? internalNotes : existing.internalNotes;
  const mergedPhone = contactPhone !== undefined ? contactPhone : existing.contactPhone;
  const mergedEmail = contactEmail !== undefined ? contactEmail : existing.contactEmail;
  const mergedAddress = investmentAddress !== undefined ? investmentAddress : existing.investmentAddress;
  const mergedCity = investmentCity !== undefined ? investmentCity : existing.investmentCity;

  const photoCount = await prisma.inquiryPhoto.count({ where: { inquiryId: id } });
  const analysis = analyzeInquiry({
    serviceType: mergedServiceType,
    aestheticsScale: mergedScale,
    priorities: mergedPriorities,
    expectedDate: mergedExpectedDate,
    formAnswers: mergedFormAnswers,
    contactPhone: mergedPhone,
    contactEmail: mergedEmail,
    investmentAddress: mergedAddress,
    investmentCity: mergedCity,
    budgetRange: mergedBudgetRange,
    internalNotes: mergedInternalNotes,
    _count: { photos: photoCount },
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
      ...(formAnswers !== undefined ? { formAnswers: mergedFormAnswers } : {}),
      ...(aestheticsScale !== undefined ? { aestheticsScale: mergedScale } : {}),
      ...(priorities !== undefined ? { priorities: mergedPriorities } : {}),
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

  await prisma.inquiry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
