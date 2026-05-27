import { prisma } from "./prisma";

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await prisma.orderCounter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, year, count: 0 },
  });

  if (counter.year !== year) {
    await prisma.orderCounter.update({
      where: { id: 1 },
      data: { year, count: 1 },
    });
    return `ZL-${year}-0001`;
  }

  const updated = await prisma.orderCounter.update({
    where: { id: 1 },
    data: { count: { increment: 1 } },
  });

  return `ZL-${year}-${String(updated.count).padStart(4, "0")}`;
}

export async function generateProtocolNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await prisma.protocolCounter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, year, count: 0 },
  });

  if (counter.year !== year) {
    await prisma.protocolCounter.update({
      where: { id: 1 },
      data: { year, count: 1 },
    });
    return `PT-${year}-0001`;
  }

  const updated = await prisma.protocolCounter.update({
    where: { id: 1 },
    data: { count: { increment: 1 } },
  });

  return `PT-${year}-${String(updated.count).padStart(4, "0")}`;
}
