import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; checklistId: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { itemId } = await params;

  const { isChecked, note } = await req.json();
  const now = new Date();

  const updated = await prisma.orderChecklistItem.update({
    where: { id: itemId },
    data: {
      ...(isChecked !== undefined && {
        isChecked,
        checkedBy: isChecked ? session.user.id : null,
        checkedAt: isChecked ? now : null,
      }),
      ...(note !== undefined && { note }),
    },
  });

  return NextResponse.json({ data: updated });
}
