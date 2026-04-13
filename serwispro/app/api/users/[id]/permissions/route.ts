import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { overrides } = await req.json();

  if (!Array.isArray(overrides)) {
    return NextResponse.json(
      { error: "overrides musi być tablicą." },
      { status: 400 }
    );
  }

  // Validate effects
  for (const o of overrides) {
    if (!["ALLOW", "DENY"].includes(o.effect)) {
      return NextResponse.json(
        { error: `Nieprawidłowa wartość effect: ${o.effect}. Dozwolone: ALLOW, DENY.` },
        { status: 400 }
      );
    }
  }

  // Atomically replace all overrides for this user
  const [, created] = await prisma.$transaction([
    prisma.userPermissionOverride.deleteMany({ where: { userId: id } }),
    prisma.userPermissionOverride.createMany({
      data: overrides.map(
        (o: { permissionId: string; effect: string; reason?: string }) => ({
          userId: id,
          permissionId: o.permissionId,
          effect: o.effect,
          reason: o.reason ?? null,
          grantedBy: session.user.id,
        })
      ),
    }),
  ]);

  await logAudit({
    userId: session.user.id,
    action: "PERMISSIONS_OVERRIDES_UPDATED",
    entityType: "User",
    entityId: id,
    details: JSON.stringify({ count: created.count }),
    ipAddress: getClientIp(req),
  });

  const updatedOverrides = await prisma.userPermissionOverride.findMany({
    where: { userId: id },
    include: { permission: true },
  });

  return NextResponse.json({ data: { overrides: updatedOverrides } });
}
