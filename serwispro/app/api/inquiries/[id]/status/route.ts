import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = [
  "NOWE",
  "W_ANALIZIE",
  "BRAKUJE_INFO",
  "GOTOWE_DO_WYCENY",
  "WYCENA_PRZYGOTOWANA",
  "WYCENA_WYSLANA",
  "OCZEKUJE_NA_DECYZJE",
  "ZAAKCEPTOWANE",
  "ODRZUCONE",
  "PRZEKSZTALCONE",
  "ZAPLANOWANO_MONTAZ",
  "ZAMKNIETE",
] as const;

const STATUS_LABELS: Record<string, string> = {
  NOWE: "Nowe",
  W_ANALIZIE: "W analizie",
  BRAKUJE_INFO: "Brakuje informacji",
  GOTOWE_DO_WYCENY: "Gotowe do wyceny",
  WYCENA_PRZYGOTOWANA: "Wycena przygotowana",
  WYCENA_WYSLANA: "Wycena wysłana",
  OCZEKUJE_NA_DECYZJE: "Oczekuje na decyzję",
  ZAAKCEPTOWANE: "Zaakceptowane",
  ODRZUCONE: "Odrzucone",
  PRZEKSZTALCONE: "Przekształcone w klienta",
  ZAPLANOWANO_MONTAZ: "Zaplanowano montaż",
  ZAMKNIETE: "Zamknięte",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Nieprawidłowy status" }, { status: 400 });
  }

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const actorLabel = `${session.user.firstName} ${session.user.lastName}`;

  const updated = await prisma.inquiry.update({
    where: { id },
    data: { status },
  });

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: id,
      userId: session.user.id,
      actorLabel,
      changeType: "STATUS_CHANGE",
      description: `Status zmieniony: ${STATUS_LABELS[existing.status] ?? existing.status} → ${STATUS_LABELS[status] ?? status}`,
      fieldName: "status",
      oldValue: existing.status,
      newValue: status,
    },
  });

  return NextResponse.json(updated);
}
