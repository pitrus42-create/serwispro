import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string; iid: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { iid } = await params;
  await prisma.quoteTemplateItem.delete({ where: { id: iid } });
  return NextResponse.json({ success: true });
}
