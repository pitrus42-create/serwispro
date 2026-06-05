import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BENEFITS_TEMPLATES } from "@/lib/benefits-constants";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let created = 0;
  let skipped = 0;

  for (const tpl of DEFAULT_BENEFITS_TEMPLATES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).benefitsTemplate.findFirst({
      where: { name: tpl.name },
    });
    if (existing) { skipped++; continue; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).benefitsTemplate.create({
      data: {
        name: tpl.name,
        title: tpl.title,
        points: JSON.stringify(tpl.points),
        serviceType: tpl.serviceType,
        packageType: tpl.packageType,
        clientType: tpl.clientType,
        isDefault: true,
        createdBy: session.user.id,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
