import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, hasRole } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");

  const where = {
    isCompleted: false,
    ...(date
      ? {
          date: {
            gte: startOfDay(new Date(date)),
            lte: to ? endOfDay(new Date(to)) : endOfDay(new Date(date)),
          },
        }
      : {}),
    ...(userId ? { OR: [{ assignedUserId: userId }, { createdById: userId }] } : {}),
  };

  const tasks = await prisma.simpleTask.findMany({
    where,
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canCreate = isAdmin(session.user) ||
    hasRole(session.user, "MENEDZER") ||
    hasRole(session.user, "SZEF");

  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, description, date, assignedUserId } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });

  const task = await prisma.simpleTask.create({
    data: {
      title: title.trim(),
      description: description ?? null,
      date: date ? new Date(date) : null,
      assignedUserId: assignedUserId ?? null,
      createdById: session.user.id,
      updatedAt: new Date(),
    },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
