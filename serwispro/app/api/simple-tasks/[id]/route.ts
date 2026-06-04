import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const task = await prisma.simpleTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Toggle complete
  if ("isCompleted" in body) {
    const updated = await prisma.simpleTask.update({
      where: { id },
      data: {
        isCompleted: body.isCompleted,
        completedAt: body.isCompleted ? new Date() : null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ data: updated });
  }

  // Partial update (title, date, assignedUserId, dayOrder)
  const { title, description, date, assignedUserId, dayOrder } = body;
  const updated = await prisma.simpleTask.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: date ? new Date(date) : null }),
      ...(assignedUserId !== undefined && { assignedUserId }),
      ...(dayOrder !== undefined && { dayOrder }),
      updatedAt: new Date(),
    },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const task = await prisma.simpleTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canDelete = isAdmin(session.user) ||
    task.createdById === session.user.id ||
    task.assignedUserId === session.user.id;

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.simpleTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
