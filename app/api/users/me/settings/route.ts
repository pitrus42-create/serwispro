import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { language, theme, notifyOnAssignment, notifyOnComment } =
    await req.json();

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: {
      ...(language !== undefined && { language }),
      ...(theme !== undefined && { theme }),
      ...(notifyOnAssignment !== undefined && { notifyOnAssignment }),
      ...(notifyOnComment !== undefined && { notifyOnComment }),
    },
    create: {
      userId: session.user.id,
      language: language ?? "pl",
      theme: theme ?? "light",
      notifyOnAssignment: notifyOnAssignment ?? true,
      notifyOnComment: notifyOnComment ?? true,
    },
  });

  return NextResponse.json({ data: settings });
}
