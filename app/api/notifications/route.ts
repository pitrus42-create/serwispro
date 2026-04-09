import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const readOnly = searchParams.get("read") === "false";
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const where: Prisma.NotificationWhereInput = { userId: session.user.id };
  if (readOnly) where.isRead = false;

  const [data, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ data, unreadCount });
}
