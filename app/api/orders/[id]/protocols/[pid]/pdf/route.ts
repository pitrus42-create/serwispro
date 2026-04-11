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
  const variant = (req.nextUrl.searchParams.get("variant") ?? "print") as "print" | "report";
  const autoPrint = req.nextUrl.searchParams.get("print") === "1";

  const [protocol, order, company, photos] = await Promise.all([
    prisma.protocol.findUnique({ where: { id: pid } }),
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        location: true,
        assignments: {
          orderBy: [{ isLead: "desc" }],
          include: { user: { select: { firstName: true, lastName: true } } },
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

  const now = new Date();
  const baseUrl = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

  const TYPE_LABELS: Record<string, string> = {
    AWARIA: "Awaria",
    KONSERWACJA: "Konserwacja",
    MONTAZ: "Montaż",
    MODERNIZACJA: "Modernizacja",
    PRZEGLAD: "Przegląd",
    INSTALACJA: "Instalacja",
    INNE: "Inne",
  };

  const docTitle = variant === "report" ? "Raport Serwisowy" : "Protokół Serwisowy";

  // All assignees
  const assigneesText = order.assignments.length > 0
    ? order.assignments
        .map((a) => `${a.user.firstName} ${a.user.lastName}${a.isLead ? " (odp.)" : ""}`)
        .join(", ")
    : "—";

  // Logo
  const logoHtml = company?.logoUrl
    ? `<img src="${baseUrl}${company.logoUrl}" alt="Logo" style="max-height:52px;max-width:110px;object-fit:contain;display:block" />`
    : "";

  // Materials table
  const materialsHtml = order.materials.length > 0
    ? `<div class="section">
        <div class="section-title">Użyte materiały</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">Materiał</th>
              <th style="text-align:right;padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">Ilość</th>
              <th style="text-align:left;padding:5px 8px;border:1px solid #e5e7eb;font-weight:600">Jm.</th>
            </tr>
          </thead>
          <tbody>
            ${order.materials.map((m) => `
              <tr>
                <td style="padding:5px 8px;border:1px solid #e5e7eb">${m.stockItem?.name ?? "—"}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:right">${m.quantity}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb">${m.stockItem?.unit ?? ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  // Photo grid (report only)
  const photosHtml = variant === "report" && photos.length > 0
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

  // Signatures (print only)
  const signaturesHtml = variant === "print"
    ? `<div class="signature-row">
        <div class="signature-box">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis serwisanta</div>
        </div>
        <div class="signature-box">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis klienta / potwierdzenie odbioru</div>
        </div>
      </div>`
    : "";

  const scheduledDate = order.scheduledAt
    ? format(new Date(order.scheduledAt), "d MMMM yyyy", { locale: pl })
    : format(now, "d MMMM yyyy", { locale: pl });

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle} ${protocol.protocolNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: white; padding: 20px 30px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1e40af; padding-bottom: 14px; margin-bottom: 14px; }
    .header-left { display: flex; align-items: flex-start; gap: 12px; }
    .company-name { font-size: 16px; font-weight: 700; color: #1e40af; line-height: 1.2; }
    .company-details { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.55; }
    .doc-info { text-align: right; flex-shrink: 0; }
    .doc-number { font-size: 17px; font-weight: 700; color: #111; }
    .doc-type { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
    .doc-date { font-size: 10px; color: #555; margin-top: 4px; }

    /* Info boxes */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .box { border: 1px solid #e5e7eb; border-radius: 5px; padding: 8px 10px; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 3px; font-weight: 600; }
    .box-value { font-size: 12px; font-weight: 600; line-height: 1.3; }
    .box-sub { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4; }

    /* Sections */
    .section { margin-bottom: 11px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 7px; }
    .text-block { border: 1px solid #e5e7eb; border-radius: 5px; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; min-height: 52px; white-space: pre-wrap; color: #333; }

    /* Photos */
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .photo-wrap { aspect-ratio: 4/3; overflow: hidden; border-radius: 4px; border: 1px solid #e5e7eb; background: #f9fafb; }
    .photo-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* Signatures */
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1px solid #333; height: 48px; }
    .sig-label { font-size: 10px; color: #555; text-align: center; margin-top: 6px; }

    /* Footer */
    .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 7px; font-size: 9px; color: #9ca3af; text-align: center; }

    @media print {
      body { padding: 0; font-size: 11px; }
      @page { margin: 12mm 15mm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header: logo + company | document info -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <div>
        <div class="company-name">${company?.name ?? "SerwisPro"}</div>
        <div class="company-details">
          ${company?.address ? company.address + "<br/>" : ""}
          ${company?.phone ? "Tel: " + company.phone : ""}${company?.email ? " &middot; " + company.email : ""}
          ${company?.nip ? "<br/>NIP: " + company.nip : ""}
        </div>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-number">${protocol.protocolNumber}</div>
      <div class="doc-type">${docTitle}</div>
      <div class="doc-date">Data: ${scheduledDate}</div>
    </div>
  </div>

  <!-- Info boxes: order, client, location, assignees -->
  <div class="grid-2">
    <div class="box">
      <div class="box-label">Zlecenie</div>
      <div class="box-value">${order.orderNumber}</div>
      <div class="box-sub">${TYPE_LABELS[order.type] ?? order.type}</div>
      ${order.scheduledAt ? `<div class="box-sub">Termin: ${format(new Date(order.scheduledAt), "d.MM.yyyy", { locale: pl })}${order.scheduledEndAt ? " – " + format(new Date(order.scheduledEndAt), "HH:mm", { locale: pl }) : ""}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Klient</div>
      <div class="box-value">${order.client?.name ?? "—"}</div>
      ${order.client?.phone ? `<div class="box-sub">Tel: ${order.client.phone}</div>` : ""}
      ${order.client?.nip ? `<div class="box-sub">NIP: ${order.client.nip}</div>` : ""}
      ${order.client?.email ? `<div class="box-sub">${order.client.email}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Lokalizacja</div>
      <div class="box-value">${order.location?.name ?? "—"}</div>
      ${order.location?.address ? `<div class="box-sub">${order.location.address}</div>` : ""}
      ${order.location?.city && order.location.city !== order.location.address ? `<div class="box-sub">${order.location.city}</div>` : ""}
    </div>
    <div class="box">
      <div class="box-label">Serwisant(ci)</div>
      <div class="box-value" style="font-size:11px;font-weight:500">${assigneesText}</div>
      ${(content.hoursFrom || content.hoursTo) ? `<div class="box-sub">Czas pracy: ${content.hoursFrom ?? "—"}&nbsp;&ndash;&nbsp;${content.hoursTo ?? "—"}</div>` : ""}
    </div>
  </div>

  <!-- Opis wykonanych prac -->
  <div class="section">
    <div class="section-title">Opis wykonanych prac</div>
    <div class="text-block">${content.description ?? order.description ?? ""}</div>
  </div>

  <!-- Uwagi / zalecenia -->
  ${content.notes ? `
  <div class="section">
    <div class="section-title">Uwagi / zalecenia</div>
    <div class="text-block">${content.notes}</div>
  </div>` : ""}

  <!-- Materiały -->
  ${materialsHtml}

  <!-- Dokumentacja fotograficzna (raport only) -->
  ${photosHtml}

  <!-- Podpisy (protokół only) -->
  ${signaturesHtml}

  <div class="footer">
    ${docTitle} &nbsp;&middot;&nbsp; Wygenerowany ${format(now, "d.MM.yyyy HH:mm", { locale: pl })} &nbsp;&middot;&nbsp; ${company?.name ?? "SerwisPro"}
  </div>

  <script>
    window.onload = function() {
      ${autoPrint ? "setTimeout(() => window.print(), 350);" : ""}
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
