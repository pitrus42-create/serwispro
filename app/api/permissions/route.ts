import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });

  // Group by module for easier UI consumption
  const grouped: Record<string, typeof permissions> = {};
  for (const p of permissions) {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  }

  return NextResponse.json({ data: grouped });
}
