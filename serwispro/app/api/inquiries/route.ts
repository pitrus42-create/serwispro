import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInquiryNumber } from "@/lib/order-number";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.split(",").filter(Boolean);
  const serviceType = searchParams.get("serviceType")?.split(",").filter(Boolean);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const where = {
    ...(status?.length ? { status: { in: status } } : {}),
    ...(serviceType?.length ? { serviceType: { in: serviceType } } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { inquiryNumber: { contains: q } },
            { contactName: { contains: q } },
            { contactEmail: { contains: q } },
            { contactPhone: { contains: q } },
            { companyName: { contains: q } },
          ],
        }
      : {}),
  };

  const total = await prisma.inquiry.count({ where });
  const data = await prisma.inquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      _count: { select: { photos: true, quotes: true } },
    },
  });

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    serviceType,
    source = "RECZNE",
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

  if (!serviceType || !contactName) {
    return NextResponse.json({ error: "serviceType i contactName są wymagane" }, { status: 400 });
  }

  const inquiryNumber = await generateInquiryNumber();
  const publicToken = randomBytes(32).toString("hex");
  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const inquiry = await prisma.inquiry.create({
    data: {
      inquiryNumber,
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
      formAnswers: formAnswers ? JSON.stringify(formAnswers) : "{}",
      aestheticsScale: aestheticsScale ? parseInt(aestheticsScale) : null,
      priorities: priorities ? JSON.stringify(priorities) : "[]",
      expectedDate,
      budgetRange,
      internalNotes,
      publicToken,
      changeLogs: {
        create: {
          userId: session.user.id,
          actorLabel,
          changeType: "CREATED",
          description: `Zapytanie utworzone przez ${actorLabel}`,
        },
      },
    },
  });

  return NextResponse.json(inquiry, { status: 201 });
}
