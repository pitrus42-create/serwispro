import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { roles: true, permissions: true },
    orderBy: { firstName: "asc" },
  });

  // Remove password hashes
  const safe = users.map(({ passwordHash: _, ...u }) => u);
  return NextResponse.json({ data: safe });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { firstName, lastName, email, password, roles = ["SERWISANT"], permissions = {} } = await req.json();

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: hash,
      roles: { create: roles.map((r: string) => ({ role: r })) },
      permissions: {
        create: {
          canCreateOrders: permissions.canCreateOrders ?? true,
          canCloseOrders: permissions.canCloseOrders ?? true,
          canGeneratePdf: permissions.canGeneratePdf ?? true,
          canViewAllCalendar: permissions.canViewAllCalendar ?? true,
        },
      },
    },
    include: { roles: true, permissions: true },
  });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ data: safe }, { status: 201 });
}
