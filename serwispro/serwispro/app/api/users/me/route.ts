import { auth, getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_INCLUDE, sanitizeUser } from "@/app/api/users/route";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: USER_INCLUDE,
  });

  if (!user) {
    return NextResponse.json({ error: "Nie znaleziono użytkownika." }, { status: 404 });
  }

  return NextResponse.json({
    data: sanitizeUser(user as unknown as Record<string, unknown>),
  });
}
