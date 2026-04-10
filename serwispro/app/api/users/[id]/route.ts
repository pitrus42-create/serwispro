import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Users can view their own profile; admins can view anyone
  if (id !== session.user.id && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: true, permissions: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ data: safe });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const isSelf = id === session.user.id;
  const admin = isAdmin(session.user);
  if (!isSelf && !admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { firstName, lastName, email, phone, password, permissions } = body;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && admin && { email }),
      ...(phone !== undefined && { phone }),
      ...(password && isSelf && { passwordHash: await bcrypt.hash(password, 12) }),
      ...(permissions && admin && {
        permissions: {
          update: {
            where: { userId: id },
            data: permissions,
          },
        },
      }),
    },
    include: { roles: true, permissions: true },
  });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ data: safe });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
