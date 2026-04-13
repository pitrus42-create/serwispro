import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit, getClientIp } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password";
import { checkCanManageTarget, checkNotSuperAdmin } from "@/lib/user-guards";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { newPassword } = await req.json();

  if (!newPassword) {
    return NextResponse.json(
      { error: "Nowe hasło jest wymagane." },
      { status: 400 }
    );
  }

  const { valid, errors } = validatePasswordStrength(newPassword);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Hasło nie spełnia wymagań.",
        fields: { password: errors.join(", ") },
      },
      { status: 400 }
    );
  }

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId: id },
    include: { role: true },
  });
  const targetRoles = assignments.map((a) => a.role.name);

  const superAdminGuard = checkNotSuperAdmin(targetRoles);
  if (superAdminGuard) return superAdminGuard;

  const manageGuard = checkCanManageTarget(session.user.roles, targetRoles);
  if (manageGuard) return manageGuard;

  const hash = await bcrypt.hash(newPassword, 12);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userUpdateData: any = {
    passwordHash: hash,
    mustChangePassword: true,
    passwordChangedAt: new Date(),
    tempPasswordPlain: newPassword,
  };

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: userUpdateData,
    }),
    prisma.passwordReset.create({
      data: {
        userId: id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: session.user.id,
      },
    }),
  ]);

  await logAudit({
    userId: session.user.id,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
