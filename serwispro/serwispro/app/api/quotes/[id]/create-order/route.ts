import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

const SERVICE_TO_ORDER_TYPE: Record<string, string> = {
  CCTV: "MONTAZ", ALARM: "MONTAZ", BRAMA: "MONTAZ",
  DOMOFON: "MONTAZ", SIEC: "MONTAZ",
  AWARIA: "AWARIA", KONSERWACJA: "KONSERWACJA",
  MODERNIZACJA: "MODERNIZACJA", INNE: "INNE",
};

const SERVICE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV", ALARM: "System alarmowy", BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon/wideodomofon", SIEC: "Sieć LAN/Wi-Fi",
  AWARIA: "Awaria", KONSERWACJA: "Konserwacja", MODERNIZACJA: "Modernizacja", INNE: "Inne",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    orderType,
    scheduledAt,
    scheduledEndAt,
    title,
    responsibleId,
    helperIds = [],
    note,
  } = body;

  if (!orderType) {
    return NextResponse.json({ error: "orderType jest wymagany" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      packages: { include: { items: true } },
      acceptance: true,
      inquiry: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Nie znaleziono wyceny" }, { status: 404 });

  // Znajdź zaakceptowany pakiet
  const acceptedPackageType = quote.acceptance?.acceptedPackage ?? "STANDARD";
  const acceptedPackage = quote.packages.find(p => p.packageType === acceptedPackageType)
    ?? quote.packages.find(p => p.isRecommended)
    ?? quote.packages[0];

  const serviceLabel = SERVICE_LABELS[quote.serviceType ?? ""] ?? quote.serviceType ?? "";
  const orderNumber = await generateOrderNumber();

  // Opis z danych zapytania i wyceny
  const descriptionParts: string[] = [];
  if (quote.summary) descriptionParts.push(quote.summary);
  if (quote.inquiry?.aestheticsScale) {
    descriptionParts.push(`Skala estetyki: ${quote.inquiry.aestheticsScale}/10`);
  }
  const description = descriptionParts.join("\n\n") || null;

  // Notatki wewnętrzne — zakres z pakietu + odniesienie do wyceny
  const internalParts: string[] = [];
  internalParts.push(`Zlecenie utworzone z wyceny ${quote.quoteNumber} (Pakiet ${acceptedPackageType})`);
  if (quote.inquiryId && quote.inquiry) {
    internalParts.push(`Zapytanie: ${quote.inquiry.inquiryNumber}`);
  }
  if (acceptedPackage?.includes) internalParts.push(`Wliczone: ${acceptedPackage.includes}`);
  if (acceptedPackage?.excludes) internalParts.push(`Nie wliczone: ${acceptedPackage.excludes}`);
  if (note) internalParts.push(note);
  const internalNotes = internalParts.join("\n");

  // Znajdź klienta (może być już w bazie po konwersji)
  const clientId = quote.inquiry?.clientId ?? null;

  // Utwórz zlecenie
  const order = await prisma.order.create({
    data: {
      orderNumber,
      type: orderType,
      status: "OCZEKUJACE",
      priority: "NORMALNY",
      clientId,
      title: title ?? `${serviceLabel} — ${quote.clientName ?? ""}`.trim(),
      description,
      internalNotes,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null,
      createdById: session.user.id,
      assignments: {
        create: [
          ...(responsibleId ? [{ userId: responsibleId, isLead: true }] : []),
          ...helperIds.map((uid: string) => ({ userId: uid, isLead: false })),
        ],
      },
    },
  });

  // Dodaj pozycje z pakietu jako materiały zlecenia
  if (acceptedPackage?.items?.length) {
    await prisma.orderMaterial.createMany({
      data: acceptedPackage.items
        .filter(item => item.isVisibleToClient || true) // wszystkie pozycje
        .map(item => ({
          orderId: order.id,
          manualName: item.modelName ? `${item.name} (${item.modelName})` : item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.netPrice,
          notes: item.description ?? null,
          addedBy: session.user.id,
        })),
    });
  }

  // Log aktywności
  await prisma.orderActivityLog.create({
    data: {
      orderId: order.id,
      userId: session.user.id,
      action: "order_created",
      details: `Zlecenie utworzone z wyceny ${quote.quoteNumber}`,
    },
  });

  // Zaktualizuj status zapytania
  if (quote.inquiryId) {
    await prisma.inquiry.update({
      where: { id: quote.inquiryId },
      data: { status: "ZAPLANOWANO_MONTAZ" },
    });
    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId: quote.inquiryId,
        userId: session.user.id,
        actorLabel: `${session.user.firstName} ${session.user.lastName}`,
        changeType: "STATUS_CHANGE",
        description: `Utworzono zlecenie ${orderNumber} z wyceny ${quote.quoteNumber}`,
        newValue: order.id,
      },
    });
  }

  // Powiadom przypisanych
  const allAssigned = [...(responsibleId ? [responsibleId] : []), ...helperIds];
  if (allAssigned.length > 0) {
    await createNotification({
      userIds: allAssigned,
      type: "order_assigned",
      priority: 3,
      title: `Nowe zlecenie: ${orderNumber}`,
      message: `${serviceLabel} — ${quote.clientName ?? ""}`,
      link: `/orders/${order.id}`,
      relatedEntityType: "order",
      relatedEntityId: order.id,
    });
  }

  return NextResponse.json({ success: true, orderId: order.id, orderNumber }, { status: 201 });
}
