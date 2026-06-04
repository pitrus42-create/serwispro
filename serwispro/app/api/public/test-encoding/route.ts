import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export const dynamic = "force-dynamic";

export async function GET() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const prisma = new PrismaClient({ adapter });

  const r = await prisma.inquiry.findFirst({
    where: { inquiryNumber: "ZAP-2026-0001" },
    select: { investmentCity: true },
  });
  await prisma.$disconnect();

  const city = r?.investmentCity ?? "";
  return NextResponse.json({
    city,
    codes: [...city].map(c => c.charCodeAt(0)),
    ok: city === "Gdańsk",
  });
}
