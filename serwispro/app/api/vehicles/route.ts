import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    include: {
      serviceEntries: { orderBy: { date: "desc" }, take: 5 },
      reminders: { where: { isDone: false }, orderBy: { date: "asc" } },
    },
    orderBy: { plate: "asc" },
  });

  return NextResponse.json({ data: vehicles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const vehicle = await prisma.vehicle.create({
    data: {
      brand: body.brand ?? null,
      model: body.model ?? null,
      year: body.year ?? null,
      plate: body.plate,
      vin: body.vin ?? null,
      insuranceNumber: body.insuranceNumber ?? null,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      inspectionExpiry: body.inspectionExpiry ? new Date(body.inspectionExpiry) : null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ data: vehicle }, { status: 201 });
}
