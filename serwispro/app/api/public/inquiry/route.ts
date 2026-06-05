import { prisma } from "@/lib/prisma";
import { generateInquiryNumber } from "@/lib/order-number";
import { analyzeInquiry } from "@/lib/inquiry-analysis";
import { notifyAdmins } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    serviceType,
    source = "FORMULARZ",
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
  } = body;

  if (!serviceType || !contactName || !contactPhone) {
    return NextResponse.json(
      { error: "serviceType, contactName i contactPhone są wymagane" },
      { status: 400 }
    );
  }

  const inquiryNumber = await generateInquiryNumber();
  const publicToken = randomBytes(32).toString("hex");

  const parsedFormAnswers = formAnswers ? JSON.stringify(formAnswers) : "{}";
  const parsedPriorities = priorities ? JSON.stringify(priorities) : "[]";
  const parsedScale = aestheticsScale ? parseInt(aestheticsScale) : null;

  const analysis = analyzeInquiry({
    serviceType,
    aestheticsScale: parsedScale,
    priorities: parsedPriorities,
    expectedDate: expectedDate ?? null,
    formAnswers: parsedFormAnswers,
    contactPhone: contactPhone ?? null,
    contactEmail: contactEmail ?? null,
    investmentAddress: investmentAddress ?? null,
    investmentCity: investmentCity ?? null,
    budgetRange: budgetRange ?? null,
    _count: { photos: 0 },
  });

  const inquiry = await prisma.inquiry.create({
    data: {
      inquiryNumber,
      publicToken,
      serviceType,
      source,
      contactName,
      contactPhone,
      contactEmail: contactEmail ?? null,
      companyName: companyName ?? null,
      nip: nip ?? null,
      investmentAddress: investmentAddress ?? null,
      investmentCity: investmentCity ?? null,
      investmentPostal: investmentPostal ?? null,
      formAnswers: parsedFormAnswers,
      aestheticsScale: parsedScale,
      priorities: parsedPriorities,
      expectedDate: expectedDate ?? null,
      budgetRange: budgetRange ?? null,
      tags: JSON.stringify(analysis.tags),
      autoAnalysis: JSON.stringify(analysis),
      changeLogs: {
        create: {
          actorLabel: contactName,
          changeType: "CREATED",
          description: `Zapytanie złożone przez klienta przez formularz www`,
        },
      },
    },
  });

  // Powiadom adminów o nowym zapytaniu
  try {
    const SERVICE_LABELS: Record<string, string> = {
      CCTV: "Monitoring CCTV", ALARM: "Alarm", BRAMA: "Automatyka bramowa",
      DOMOFON: "Domofon", SIEC: "Sieć LAN/Wi-Fi", AWARIA: "Awaria",
      KONSERWACJA: "Konserwacja", MODERNIZACJA: "Modernizacja", INNE: "Inne",
    };
    await notifyAdmins({
      type: "new_inquiry",
      priority: 2,
      title: `Nowe zapytanie: ${SERVICE_LABELS[serviceType] ?? serviceType}`,
      message: `${contactName}${investmentCity ? ` — ${investmentCity}` : ""} — ${inquiryNumber}`,
      link: `/inquiries/${inquiry.id}`,
      relatedEntityType: "inquiry",
      relatedEntityId: inquiry.id,
    });
  } catch {
    // Powiadomienie nie jest krytyczne
  }

  return NextResponse.json(
    { id: inquiry.id, inquiryNumber: inquiry.inquiryNumber, publicToken: inquiry.publicToken },
    { status: 201 }
  );
}
