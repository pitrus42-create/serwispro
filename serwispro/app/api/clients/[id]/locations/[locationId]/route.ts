import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; locationId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, locationId } = await params;

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, address, city, postalCode, technicalNote, systemsNote, isDefault } = body;

  // If setting as default, clear isDefault on other locations first
  if (isDefault === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.location.updateMany as any)({
      where: { clientId, id: { not: locationId } },
      data: { isDefault: false },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.location.update as any)({
    where: { id: locationId },
    data: {
      ...(name !== undefined && { name: name.trim() || location.name }),
      ...(address !== undefined && { address: address.trim() || null }),
      ...(city !== undefined && { city: city.trim() || null }),
      ...(postalCode !== undefined && { postalCode: postalCode.trim() || null }),
      ...(technicalNote !== undefined && { technicalNote: technicalNote.trim() || null }),
      ...(systemsNote !== undefined && { systemsNote: systemsNote.trim() || null }),
      ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, locationId } = await params;

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-delete to preserve order history
  await prisma.location.update({
    where: { id: locationId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
