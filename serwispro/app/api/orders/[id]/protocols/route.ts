import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProtocolNumber } from "@/lib/order-number";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const protocols = await prisma.protocol.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: protocols });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: true, location: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const protocolNumber = await generateProtocolNumber();

  const protocol = await prisma.protocol.create({
    data: {
      protocolNumber,
      orderId,
      clientId: order.clientId,
      locationId: order.locationId,
      type: body.type ?? "serwisowy",
      content: JSON.stringify(body.content ?? {}),
      createdBy: session.user.id,
    },
  });

  await prisma.orderActivityLog.create({
    data: {
      orderId,
      userId: session.user.id,
      action: "protocol_generated",
      details: JSON.stringify({ protocolNumber }),
    },
  });

  return NextResponse.json({ data: protocol }, { status: 201 });
}
