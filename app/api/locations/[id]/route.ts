import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const location = await prisma.location.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.postalCode !== undefined && { postalCode: body.postalCode }),
      ...(body.technicalNote !== undefined && { technicalNote: body.technicalNote }),
      ...(body.systemsNote !== undefined && { systemsNote: body.systemsNote }),
      ...(body.maintenanceCycle !== undefined && { maintenanceCycle: body.maintenanceCycle }),
      ...(body.nextMaintenanceDate !== undefined && {
        nextMaintenanceDate: body.nextMaintenanceDate ? new Date(body.nextMaintenanceDate) : null,
      }),
    },
  });
  return NextResponse.json({ data: location });
}
