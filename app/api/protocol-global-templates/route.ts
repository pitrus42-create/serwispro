import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Seed templates inserted when table is empty on first GET
const SEED: Array<{
  name: string;
  defaultText: string;
  defaultChecklist: string;
  defaultNotes: string;
}> = [
  {
    name: "Awaria CCTV",
    defaultText:
      "Po przyjeździe na obiekt wykonano diagnostykę zgłoszonej awarii systemu CCTV. Sprawdzono zasilanie, połączenia przewodowe, rejestrator oraz obraz z kamer. Po usunięciu usterki przeprowadzono test poprawności działania systemu.",
    defaultChecklist: JSON.stringify([
      { text: "Zdiagnozowano zgłoszoną usterkę", status: "OK", comment: "" },
      { text: "Naprawiono uszkodzony przewód", status: "NAPRAWIONO", comment: "" },
      { text: "Wymieniono kamerę", status: "WYMIENIONO", comment: "" },
      { text: "Sprawdzono zasilanie", status: "OK", comment: "" },
      { text: "Zweryfikowano połączenia", status: "OK", comment: "" },
      { text: "Sprawdzono nagrywanie", status: "OK", comment: "" },
      { text: "Wykonano test działania", status: "WYKONANO", comment: "" },
    ]),
    defaultNotes: "System CCTV po wykonanych pracach działa prawidłowo.",
  },
  {
    name: "Serwis okresowy CCTV",
    defaultText:
      "Wykonano okresowy serwis systemu monitoringu CCTV. Prace obejmowały kontrolę obrazu, nagrywania, zasilania oraz ustawień rejestratora.",
    defaultChecklist: JSON.stringify([
      { text: "Sprawdzono obraz z kamer", status: "OK", comment: "" },
      { text: "Zweryfikowano działanie trybu nocnego / IR", status: "OK", comment: "" },
      { text: "Sprawdzono zapis nagrań", status: "OK", comment: "" },
      { text: "Skontrolowano rejestrator", status: "OK", comment: "" },
      { text: "Sprawdzono stan dysku", status: "OK", comment: "" },
      { text: "Zweryfikowano podgląd zdalny", status: "OK", comment: "" },
      { text: "Skontrolowano ustawienia daty i godziny", status: "OK", comment: "" },
    ]),
    defaultNotes:
      "Zaleca się regularną kontrolę poprawności nagrań oraz okresowe czyszczenie kamer.",
  },
  {
    name: "Zasilanie / PoE",
    defaultText:
      "Wykonano kontrolę zasilania urządzeń oraz połączeń sieciowych. Sprawdzono działanie switcha PoE, przewodów oraz zasilania awaryjnego.",
    defaultChecklist: JSON.stringify([
      { text: "Sprawdzono zasilanie switcha PoE", status: "OK", comment: "" },
      { text: "Zweryfikowano pobór mocy na portach", status: "OK", comment: "" },
      { text: "Sprawdzono połączenia kablowe", status: "OK", comment: "" },
      { text: "Skontrolowano UPS / zasilacz awaryjny", status: "OK", comment: "" },
    ]),
    defaultNotes: "Zasilanie urządzeń działa prawidłowo.",
  },
];

function deserialize(t: {
  id: string;
  name: string;
  defaultText: string;
  defaultChecklist: string;
  defaultNotes: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...t,
    defaultChecklist: JSON.parse(t.defaultChecklist ?? "[]"),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let templates = await prisma.protocolGlobalTemplate.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Seed on first use
  if (templates.length === 0) {
    await prisma.protocolGlobalTemplate.createMany({ data: SEED });
    templates = await prisma.protocolGlobalTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  return NextResponse.json({ data: templates.map(deserialize) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });
  }

  const template = await prisma.protocolGlobalTemplate.create({
    data: {
      name: body.name.trim(),
      defaultText: body.defaultText ?? "",
      defaultChecklist: JSON.stringify(body.defaultChecklist ?? []),
      defaultNotes: body.defaultNotes ?? "",
      createdBy: session.user?.id ?? null,
    },
  });

  return NextResponse.json({ data: deserialize(template) }, { status: 201 });
}
