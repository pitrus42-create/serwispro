import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      serviceEntries: { orderBy: { date: "desc" }, take: 20 },
      reminders: { orderBy: { date: "asc" } },
    },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: vehicle });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(body.brand !== undefined && { brand: body.brand }),
      ...(body.model !== undefined && { model: body.model }),
      ...(body.year !== undefined && { year: body.year }),
      ...(body.plate !== undefined && { plate: body.plate }),
      ...(body.vin !== undefined && { vin: body.vin }),
      ...(body.insuranceNumber !== undefined && { insuranceNumber: body.insuranceNumber }),
      ...(body.insuranceExpiry !== undefined && {
        insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      }),
      ...(body.inspectionExpiry !== undefined && {
        inspectionExpiry: body.inspectionExpiry ? new Date(body.inspectionExpiry) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });
  return NextResponse.json({ data: vehicle });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
