import { db } from "@/lib/db";
import { generateInquiryNumber } from "@/lib/order-number";
import { notifyAdmins } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";

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
  const id = uuidv4();
  const changeLogId = uuidv4();
  const now = new Date().toISOString();

  await db.batch([
    {
      sql: `INSERT INTO "Inquiry" (
        id, inquiryNumber, publicToken, status, serviceType, source,
        contactName, contactPhone, contactEmail, companyName, nip,
        investmentAddress, investmentCity, investmentPostal,
        formAnswers, aestheticsScale, priorities,
        expectedDate, budgetRange, convertedToClient, createdAt, updatedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
      args: [
        id, inquiryNumber, publicToken, "NOWE", serviceType, source,
        contactName, contactPhone, contactEmail ?? null, companyName ?? null, nip ?? null,
        investmentAddress ?? null, investmentCity ?? null, investmentPostal ?? null,
        formAnswers ? JSON.stringify(formAnswers) : "{}",
        aestheticsScale ? parseInt(aestheticsScale) : null,
        priorities ? JSON.stringify(priorities) : "[]",
        expectedDate ?? null, budgetRange ?? null,
        now, now,
      ],
    },
    {
      sql: `INSERT INTO "InquiryChangeLog" (id, inquiryId, actorLabel, changeType, description, createdAt)
            VALUES (?,?,?,?,?,?)`,
      args: [changeLogId, id, contactName, "CREATED", "Zapytanie złożone przez klienta przez formularz www", now],
    },
  ]);

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
      link: `/inquiries/${id}`,
      relatedEntityType: "inquiry",
      relatedEntityId: id,
    });
  } catch {
    // Powiadomienie nie jest krytyczne
  }

  return NextResponse.json(
    { id, inquiryNumber, publicToken },
    { status: 201 }
  );
}
