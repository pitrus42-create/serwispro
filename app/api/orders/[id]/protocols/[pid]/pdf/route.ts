import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { readFile } from "fs/promises";
import pathModule from "path";

type Params = { params: Promise<{ id: string; pid: string }> };

async function fileUrlToDataUri(fileUrl: string, baseUrl: string): Promise<string> {
  try {
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
    };

    // Firebase Storage or any HTTP URL — fetch directly
    if (fileUrl.startsWith("http")) {
      const res = await fetch(fileUrl);
      if (!res.ok) return "";
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const bytes = Buffer.from(await res.arrayBuffer());
      return `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
    }

    // Local dev — read from public/ directory
    const relative = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
    const filePath = pathModule.join(process.cwd(), "public", relative);
    const bytes = await readFile(filePath);
    const ext = (filePath.split(".").pop() ?? "jpg").toLowerCase();
    return `data:${mimeMap[ext] ?? "image/jpeg"};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

function calcDuration(from: string, to: string): string {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let total = th * 60 + tm - (fh * 60 + fm);
  if (total < 0) total += 24 * 60;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, pid } = await params;
  const variant = (req.nextUrl.searchParams.get("variant") ?? "print") as "print" | "report";
  const download = req.nextUrl.searchParams.get("download") === "1";
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
  try { content = JSON.parse(protocol.content); } catch { /* empty */ }

  const now = new Date();
  const baseUrl = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

  const TYPE_LABELS: Record<string, string> = {
    AWARIA: "Awaria", KONSERWACJA: "Konserwacja", MONTAZ: "Montaż",
    MODERNIZACJA: "Modernizacja", PRZEGLAD: "Przegląd", INSTALACJA: "Instalacja", INNE: "Inne",
  };

  const docTitle = variant === "report" ? "Raport Serwisowy" : "Protokół Serwisowy";

  const assigneesText = order.assignments.length > 0
    ? order.assignments
        .map((a) => `${a.user.firstName} ${a.user.lastName}`)
        .join(", ")
    : "—";

  // Hours box
  const hFrom = content.hoursFrom ?? "";
  const hTo = content.hoursTo ?? "";
  const hoursBox = hFrom || hTo
    ? `<div class="box">
        <div class="box-label">Czas pracy</div>
        <div class="box-value">${hFrom || "—"} – ${hTo || "—"}</div>
        ${hFrom && hTo ? `<div class="box-sub">Łącznie: ${calcDuration(hFrom, hTo)}</div>` : ""}
      </div>`
    : "";

  // Logo — embed as base64 for download, use URL for preview
  let logoSrc = "";
  if (company?.logoUrl) {
    if (download) {
      logoSrc = await fileUrlToDataUri(company.logoUrl, baseUrl);
    } else {
      // For HTTP preview use the URL directly (Firebase Storage or local)
      logoSrc = company.logoUrl.startsWith("http") ? company.logoUrl : `${baseUrl}${company.logoUrl}`;
    }
  }
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Logo" style="max-height:52px;max-width:110px;object-fit:contain;display:block" />`
    : "";

  // Materials
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

  // Photos — embed as base64 when downloading; shown for all variants if photos exist
  let photosHtml = "";
  if (photos.length > 0) {
    const shown = photos.slice(0, 6);
    const photoSrcs = await Promise.all(
      shown.map(async (p) => {
        if (download) {
          const dataUri = await fileUrlToDataUri(p.fileUrl, baseUrl);
          return dataUri || (p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`);
        }
        return p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`;
      })
    );
    // Grid columns and fixed cell height — fewer photos = taller cells
    // viewport width=794 ensures consistent rendering; heights tuned to always fit on 1 A4 page
    const count = shown.length;
    let cols: number, cellHeight: string;
    if (count === 1)      { cols = 1; cellHeight = "190px"; }
    else if (count === 2) { cols = 2; cellHeight = "170px"; }
    else if (count === 3) { cols = 3; cellHeight = "150px"; }
    else if (count === 4) { cols = 2; cellHeight = "105px"; }
    else                  { cols = 3; cellHeight = "95px"; }
    photosHtml = `<div class="section" style="page-break-inside:avoid">
      <div class="section-title">Dokumentacja fotograficzna (${photos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px">
        ${photoSrcs.map((src) => src
          ? `<div style="height:${cellHeight};overflow:hidden;border-radius:4px;border:1px solid #ddd;background:#f5f5f5">
               <img src="${src}" style="width:100%;height:100%;object-fit:contain;display:block" alt="" />
             </div>`
          : ""
        ).join("")}
      </div>
      ${photos.length > 6 ? `<p style="font-size:9px;color:#999;margin-top:4px;text-align:right">Pokazano 6 z ${photos.length} zdjęć</p>` : ""}
    </div>`;
  }

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

  // Client address for header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAny = order.client as any;
  const clientAddr = [clientAny?.address, clientAny?.postalCode, clientAny?.city].filter(Boolean).join(", ");

  // Info grid: Zlecenie + optional Lokalizacja + Serwisant + optional Czas pracy
  const infoBoxCount = 2 + (order.location ? 1 : 0) + (hoursBox ? 1 : 0);
  const infoGridCols = infoBoxCount <= 2 ? 2 : infoBoxCount === 3 ? 3 : 4;
  const infoGridStyle = `display:grid;grid-template-columns:repeat(${infoGridCols},1fr);gap:8px;margin-bottom:12px`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794" />
  <title>${docTitle} ${protocol.protocolNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    /* ── Brand colours (All-Secure logo) ── */
    :root { --red: #8B1A1A; --red-light: #f5e6e6; --gray: #4a4a4a; --border: #ddd; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: white; padding: 20px 30px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8B1A1A; padding-bottom: 14px; margin-bottom: 14px; }
    .header-left { display: flex; align-items: flex-start; gap: 12px; }
    .company-name { font-size: 16px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .company-details { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.55; }
    .doc-info { text-align: right; flex-shrink: 0; }
    .doc-number { font-size: 17px; font-weight: 700; color: #8B1A1A; }
    .doc-type { font-size: 10px; color: #4a4a4a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
    .doc-date { font-size: 10px; color: #666; margin-top: 4px; }
    .box { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #8B1A1A; margin-bottom: 3px; font-weight: 700; }
    .box-value { font-size: 12px; font-weight: 600; line-height: 1.3; color: #1a1a1a; }
    .box-sub { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4; }
    .section { margin-bottom: 11px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #8B1A1A; font-weight: 700; border-bottom: 1.5px solid #8B1A1A; padding-bottom: 3px; margin-bottom: 7px; }
    .text-block { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; min-height: 52px; white-space: pre-wrap; color: #1a1a1a; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1.5px solid #8B1A1A; height: 48px; }
    .sig-label { font-size: 10px; color: #555; text-align: center; margin-top: 6px; }
    @media print {
      body { padding: 0; font-size: 11px; }
      @page {
        size: A4;
        margin: 12mm 15mm;
        /* Remove browser header/footer (date, URL) */
        margin-top: 12mm;
      }
      .no-print { display: none !important; }
    }
    .print-hint {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #8B1A1A; color: white; text-align: center;
      padding: 10px 16px; font-size: 13px; font-family: Arial, sans-serif;
      display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .print-hint strong { font-size: 14px; }
    body { padding-top: ${autoPrint ? "48px" : "0"}; }
  </style>
  ${autoPrint ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 800); });<\/script>` : ""}
</head>
<body>
  ${autoPrint ? `
  <div class="no-print print-hint">
    <span>📄</span>
    <span>Aby ukryć datę i adres URL: w oknie drukowania kliknij <strong>„Więcej ustawień"</strong> → odznacz <strong>„Nagłówki i stopki"</strong> → kliknij Zapisz</span>
  </div>` : ""}
  <!-- Title centered -->
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-size:17px;font-weight:700;color:#8B1A1A;text-transform:uppercase;letter-spacing:0.8px">${docTitle}</div>
    <div style="font-size:12px;font-weight:600;color:#4a4a4a;margin-top:3px">Nr ${protocol.protocolNumber} &nbsp;·&nbsp; ${scheduledDate}</div>
  </div>

  <!-- Company (left) | Client (right) -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:3px solid #8B1A1A;padding-bottom:12px;margin-bottom:14px">
    <div style="display:flex;align-items:flex-start;gap:10px">
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
    <div style="text-align:right;flex-shrink:0">
      ${order.client?.name ? `<div style="font-size:13px;font-weight:700;color:#1a1a1a">${order.client.name}</div>` : ""}
      <div style="font-size:10px;color:#555;margin-top:3px;line-height:1.6">
        ${clientAddr ? clientAddr + "<br/>" : ""}
        ${order.client?.nip ? "NIP: " + order.client.nip + "<br/>" : ""}
        ${order.client?.phone ? "Tel: " + order.client.phone : ""}
      </div>
    </div>
  </div>

  <div style="${infoGridStyle}">
    <div class="box">
      <div class="box-label">Zlecenie</div>
      <div class="box-value">${order.orderNumber}</div>
      <div class="box-sub">${TYPE_LABELS[order.type] ?? order.type}</div>
      ${order.scheduledAt ? `<div class="box-sub">Termin: ${format(new Date(order.scheduledAt), "d.MM.yyyy", { locale: pl })}${order.scheduledEndAt ? " – " + format(new Date(order.scheduledEndAt), "HH:mm", { locale: pl }) : ""}</div>` : ""}
    </div>
    ${order.location ? `
    <div class="box">
      <div class="box-label">Lokalizacja</div>
      <div class="box-value">${order.location.name}</div>
      ${order.location.address ? `<div class="box-sub">${order.location.address}</div>` : ""}
      ${(() => { const loc = order.location as any; const line = [loc?.postalCode, loc?.city].filter(Boolean).join(" "); return line ? `<div class="box-sub">${line}</div>` : ""; })()}
    </div>` : ""}
    <div class="box">
      <div class="box-label">Serwisant</div>
      <div class="box-value" style="font-size:11px;font-weight:500">${assigneesText}</div>
    </div>
    ${hoursBox}
  </div>

  <div class="section">
    <div class="section-title">Opis wykonanych prac</div>
    <div class="text-block">${content.description ?? order.description ?? ""}</div>
  </div>

  ${content.notes ? `
  <div class="section">
    <div class="section-title">Uwagi / zalecenia</div>
    <div class="text-block">${content.notes}</div>
  </div>` : ""}

  ${materialsHtml}
  ${signaturesHtml}
  ${photosHtml}
</body>
</html>`;

  // --- HTML (preview + print-as-PDF) ---
  // Puppeteer is not available on Firebase App Hosting (no Chromium).
  // The browser's built-in print dialog produces perfect PDFs.
  // ?print=1  → auto-opens print dialog (used by "Pobierz PDF" button)
  // no param  → plain preview (used by "Podgląd" button)
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
