import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get("serviceType");

  const templates = await prisma.quoteTemplate.findMany({
    where: {
      isActive: true,
      ...(serviceType ? { serviceType } : {}),
    },
    include: {
      packages: { include: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, serviceType, description, conditions, internalNotes } = body;

  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const template = await prisma.quoteTemplate.create({
    data: {
      name,
      serviceType: serviceType ?? null,
      description: description ?? null,
      conditions: conditions ?? null,
      internalNotes: internalNotes ?? null,
      createdBy: session.user.id,
      packages: {
        create: [
          { packageType: "MINIMUM", name: "Pakiet Minimum", description: "Podstawowy system w budżetowej cenie." },
          { packageType: "STANDARD", name: "Pakiet Standard", description: "Rekomendowany wariant — najlepszy stosunek ceny do jakości." },
          { packageType: "PRO",      name: "Pakiet Pro",     description: "Profesjonalne rozwiązanie z pełną konfiguracją." },
        ],
      },
    },
    include: { packages: { include: { items: true } } },
  });

  return NextResponse.json(template, { status: 201 });
}
