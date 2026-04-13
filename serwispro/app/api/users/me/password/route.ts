import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Obecne i nowe hasło są wymagane." },
      { status: 400 }
    );
  }

  const { valid, errors } = validatePasswordStrength(newPassword);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Nowe hasło nie spełnia wymagań.",
        fields: { newPassword: errors.join(", ") },
      },
      { status: 400 }
    );
  }

  // Always load fresh from DB — don't trust JWT for sensitive operations
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "Nie można zmienić hasła dla tego konta." },
      { status: 422 }
    );
  }

  const valid2 = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid2) {
    return NextResponse.json(
      { error: "Obecne hasło jest nieprawidłowe." },
      { status: 401 }
    );
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await logAudit({
    userId: user.id,
    action: "PASSWORD_CHANGED_SELF",
    entityType: "User",
    entityId: user.id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
