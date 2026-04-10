import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, pid } = await params;

  const [protocol, order, company, photos] = await Promise.all([
    prisma.protocol.findUnique({ where: { id: pid } }),
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        location: true,
        assignments: {
          where: { isLead: true },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        checklists: {
          include: { items: { orderBy: { itemOrder: "asc" } } },
        },
        materials: {
          include: { stockItem: { select: { name: true, unit: true } } },
        },
      },
    }),
    prisma.companySettings.findUnique({ where: { id: 1 } }),
    prisma.protocolPhoto.findMany({
      where: { protocolId: pid },
      orderBy: { uploadedAt: "asc" },
    }),
  ]);

  if (!protocol || !order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let content: Record<string, string> = {};
  try {
    content = JSON.parse(protocol.content);
  } catch {
    content = {};
  }

  const lead = order.assignments[0]?.user;
  const now = new Date();

  const TYPE_LABELS: Record<string, string> = {
    AWARIA: "Awaria",
    KONSERWACJA: "Konserwacja",
    MONTAZ: "Montaż",
    MODERNIZACJA: "Modernizacja",
    INNE: "Inne",
  };

  const checklistsHtml = order.checklists.length > 0
    ? `<div class="section">
        <div class="section-title">Checklista</div>
        ${order.checklists.map((cl) => `
          <div style="margin-bottom:8px">
            <div style="font-weight:600;margin-bottom:4px;font-size:11px">${cl.name}</div>
            ${cl.items.map((item) => `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                <div style="width:12px;height:12px;border:1.5px solid #333;border-radius:2px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
                  ${item.isChecked ? `<div style="width:7px;height:7px;background:#333;border-radius:1px"></div>` : ""}
                </div>
                <span style="font-size:11px">${item.text}</span>
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>`
    : "";

  const materialsHtml = order.materials.length > 0
    ? `<div class="section">
        <div class="section-title">Użyte materiały</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:4px 7px;border:1px solid #e5e7eb">Materiał</th>
              <th style="text-align:right;padding:4px 7px;border:1px solid #e5e7eb">Ilość</th>
            </tr>
          </thead>
          <tbody>
            ${order.materials.map((m) => `
              <tr>
                <td style="padding:4px 7px;border:1px solid #e5e7eb">${m.stockItem?.name ?? "—"}</td>
                <td style="padding:4px 7px;border:1px solid #e5e7eb;text-align:right">${m.quantity} ${m.stockItem?.unit ?? ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  const baseUrl = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

  const photosHtml = photos.length > 0
    ? `<div class="section">
        <div class="section-title">Dokumentacja fotograficzna (${photos.length})</div>
        <div class="photo-grid">
          ${photos.slice(0, 6).map((p) => `
            <div class="photo-wrap">
              <img src="${baseUrl}${p.fileUrl}" class="photo-thumb" alt="" />
            </div>
          `).join("")}
        </div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Protokół ${protocol.protocolNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: white; padding: 20px 30px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 14px; }
    .company-name { font-size: 17px; font-weight: 700; color: #1e40af; }
    .company-details { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.5; }
    .protocol-title { text-align: right; }
    .protocol-number { font-size: 18px; font-weight: 700; color: #111; }
    .protocol-type { font-size: 11px; color: #555; margin-top: 3px; }

    /* Info grid */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .box { border: 1px solid #e5e7eb; border-radius: 5px; padding: 9px 11px; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 4px; }
    .box-value { font-size: 12px; font-weight: 600; }
    .box-sub { font-size: 10px; color: #555; margin-top: 2px; }

    /* Sections */
    .section { margin-bottom: 12px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; }
    .text-block { border: 1px solid #e5e7eb; border-radius: 5px; padding: 10px; font-size: 11.5px; line-height: 1.55; min-height: 44px; white-space: pre-wrap; color: #333; }

    /* Photos */
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
    .photo-wrap { aspect-ratio: 4/3; overflow: hidden; border-radius: 4px; border: 1px solid #e5e7eb; background: #f9fafb; }
    .photo-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* Signatures */
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
    .signature-box { border-top: 1px solid #333; padding-top: 5px; font-size: 10px; color: #555; text-align: center; }

    /* Footer */
    .footer { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #9ca3af; text-align: center; }

    @media print {
      body { padding: 0; font-size: 11px; }
      @page { margin: 12mm 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${company?.name ?? "SerwisPro"}</div>
      <div class="company-details">
        ${company?.address ? company.address + "<br/>" : ""}
        ${company?.phone ? "Tel: " + company.phone : ""}
        ${company?.email ? " · " + company.email : ""}
        ${company?.nip ? "<br/>NIP: " + company.nip : ""}
      </div>
    </div>
    <div class="protocol-title">
      <div class="protocol-number">Protokół ${protocol.protocolNumber}</div>
      <div class="protocol-type">Typ: ${protocol.type}</div>
      <div style="font-size:10px;color:#555;margin-top:3px">
        Data: ${format(now, "d MMMM yyyy", { locale: pl })}
      </div>
    </div>
  </div>

  <!-- Zlecenie i klient -->
  <div class="grid-2">
    <div class="box">
      <div class="box-label">Zlecenie</div>
      <div class="box-value">${order.orderNumber}</div>
      <div class="box-sub">${TYPE_LABELS[order.type] ?? order.type}</div>
      ${order.scheduledAt ? `<div class="box-sub">Data: ${format(new Date(order.scheduledAt), "d.MM.yyyy", { locale: pl })}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Klient</div>
      <div class="box-value">${order.client?.name ?? "—"}</div>
      ${order.client?.phone ? `<div class="box-sub">Tel: ${order.client.phone}</div>` : ""}
      ${order.client?.nip ? `<div class="box-sub">NIP: ${order.client.nip}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Lokalizacja</div>
      <div class="box-value">${order.location?.name ?? "—"}</div>
      ${order.location?.address ? `<div class="box-sub">${order.location.address}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Serwisant</div>
      <div class="box-value">${lead ? lead.firstName + " " + lead.lastName : "—"}</div>
    </div>
  </div>

  <!-- Opis prac -->
  <div class="section">
    <div class="section-title">Opis wykonanych prac</div>
    <div class="text-block">${content.description ?? order.description ?? ""}</div>
  </div>

  <!-- Uwagi -->
  ${content.notes ? `
  <div class="section">
    <div class="section-title">Uwagi / zalecenia</div>
    <div class="text-block">${content.notes}</div>
  </div>` : ""}

  <!-- Checklista -->
  ${checklistsHtml}

  <!-- Materiały -->
  ${materialsHtml}

  <!-- Zdjęcia -->
  ${photosHtml}

  <!-- Podpisy -->
  <div class="signature-row">
    <div class="signature-box">Podpis serwisanta</div>
    <div class="signature-box">Podpis klienta / potwierdzenie odbioru</div>
  </div>

  <div class="footer">
    Dokument wygenerowany ${format(now, "d.MM.yyyy HH:mm", { locale: pl })} · ${company?.name ?? "SerwisPro"}
  </div>

  <script>
    window.onload = function() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('print') === '1') {
        setTimeout(() => window.print(), 300);
      }
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
