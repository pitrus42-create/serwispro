import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      inquiryNumber: true,
      status: true,
      serviceType: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      companyName: true,
      investmentAddress: true,
      investmentCity: true,
      createdAt: true,
      photos: {
        orderBy: { addedAt: "asc" },
        select: { id: true, fileUrl: true, category: true, description: true, addedAt: true },
      },
    },
  });

  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  return NextResponse.json(inquiry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { comment } = body;

  const inquiry = await prisma.inquiry.findUnique({ where: { publicToken: token } });
  if (!inquiry) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  if (comment) {
    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId: inquiry.id,
        actorLabel: inquiry.contactName,
        changeType: "NOTE_ADDED",
        description: `Komentarz od klienta: ${comment}`,
        newValue: comment,
      },
    });

    // Jeśli status to BRAKUJE_INFO, przywróć do W_ANALIZIE
    if (inquiry.status === "BRAKUJE_INFO") {
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { status: "W_ANALIZIE" },
      });
      await prisma.inquiryChangeLog.create({
        data: {
          inquiryId: inquiry.id,
          actorLabel: inquiry.contactName,
          changeType: "STATUS_CHANGE",
          description: "Status zmieniony: Brakuje informacji → W analizie (klient uzupełnił dane)",
          fieldName: "status",
          oldValue: "BRAKUJE_INFO",
          newValue: "W_ANALIZIE",
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
