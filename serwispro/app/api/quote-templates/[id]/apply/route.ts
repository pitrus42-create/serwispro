import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/quote-templates/[id]/apply — zastosuj szablon do wyceny
// body: { quoteId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: templateId } = await params;
  const { quoteId } = await req.json();

  if (!quoteId) return NextResponse.json({ error: "quoteId jest wymagany" }, { status: 400 });

  const template = await prisma.quoteTemplate.findUnique({
    where: { id: templateId },
    include: { packages: { include: { items: true } } },
  });
  if (!template) return NextResponse.json({ error: "Szablon nie znaleziony" }, { status: 404 });

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { packages: true },
  });
  if (!quote) return NextResponse.json({ error: "Wycena nie znaleziona" }, { status: 404 });

  // Zaktualizuj pasujące pakiety z szablonu
  for (const tmplPkg of template.packages) {
    const quotePkg = quote.packages.find(p => p.packageType === tmplPkg.packageType);
    if (!quotePkg) continue;

    await prisma.quotePackage.update({
      where: { id: quotePkg.id },
      data: {
        name: tmplPkg.name,
        description: tmplPkg.description,
        includes: tmplPkg.includes,
        excludes: tmplPkg.excludes,
      },
    });

    // Dodaj pozycje z szablonu (nie usuwaj istniejących)
    if (tmplPkg.items.length > 0) {
      const grossRate = 1 + 23 / 100; // domyślne VAT
      await prisma.quoteItem.createMany({
        data: tmplPkg.items.map(item => ({
          packageId: quotePkg.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          quantity: item.quantity,
          unit: item.unit,
          netPrice: item.netPrice,
          vatRate: item.vatRate,
          grossPrice: item.netPrice * (1 + item.vatRate / 100),
          modelName: item.modelName,
        })),
      });

      // Przelicz sumy pakietu
      const allItems = await prisma.quoteItem.findMany({ where: { packageId: quotePkg.id } });
      await prisma.quotePackage.update({
        where: { id: quotePkg.id },
        data: {
          netTotal: allItems.reduce((s, i) => s + i.netPrice * i.quantity, 0),
          grossTotal: allItems.reduce((s, i) => s + i.grossPrice * i.quantity, 0),
        },
      });
    }
  }

  // Aktualizuj conditions z szablonu jeśli wycena nie ma warunków
  if (template.conditions && !quote.conditions) {
    await prisma.quote.update({ where: { id: quoteId }, data: { conditions: template.conditions } });
  }

  const updated = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { packages: { include: { items: true } }, acceptance: true },
  });

  return NextResponse.json(updated);
}
