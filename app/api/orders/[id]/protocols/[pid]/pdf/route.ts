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
    if (fileUrl.startsWith("http")) {
      const res = await fetch(fileUrl);
      if (!res.ok) return "";
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const bytes = Buffer.from(await res.arrayBuffer());
      return `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`;
    }
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
    ? order.assignments.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")
    : "—";

  const hFrom = content.hoursFrom ?? "";
  const hTo = content.hoursTo ?? "";
  const hasHours = !!(hFrom || hTo);

  const scheduledDate = order.scheduledAt
    ? format(new Date(order.scheduledAt), "d MMMM yyyy", { locale: pl })
    : format(now, "d MMMM yyyy", { locale: pl });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAny = order.client as any;
  const clientAddr = [clientAny?.address, clientAny?.postalCode, clientAny?.city].filter(Boolean).join(", ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locationAny = order.location as any;

  // Logo
  let logoSrc = "";
  if (company?.logoUrl) {
    if (download) {
      logoSrc = await fileUrlToDataUri(company.logoUrl, baseUrl);
    } else {
      logoSrc = company.logoUrl.startsWith("http") ? company.logoUrl : `${baseUrl}${company.logoUrl}`;
    }
  }
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Logo" style="max-height:48px;max-width:100px;object-fit:contain;display:block;flex-shrink:0" />`
    : "";

  // Info grid columns
  const infoBoxCount = 2 + (order.location ? 1 : 0) + (hasHours ? 1 : 0);
  const infoGridCols = infoBoxCount <= 2 ? 2 : infoBoxCount === 3 ? 3 : 4;

  // Materials table
  const materialsHtml = order.materials.length > 0
    ? `<div class="section">
        <div class="section-title">Użyte materiały</div>
        <table class="mat-table">
          <thead>
            <tr>
              <th style="text-align:left">Materiał</th>
              <th style="text-align:right;width:60px">Ilość</th>
              <th style="width:40px">Jm.</th>
            </tr>
          </thead>
          <tbody>
            ${order.materials.map((m) => `
              <tr>
                <td>${m.stockItem?.name ?? "—"}</td>
                <td style="text-align:right">${m.quantity}</td>
                <td>${m.stockItem?.unit ?? ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  // Photos
  let photosHtml = "";
  if (photos.length > 0) {
    const shown = photos.slice(0, 6);
    const photoSrcs = await Promise.all(
      shown.map(async (p) => {
        if (download) {
          const uri = await fileUrlToDataUri(p.fileUrl, baseUrl);
          return uri || (p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`);
        }
        return p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`;
      })
    );
    const count = shown.length;
    let cols: number, cellHeight: string;
    if      (count === 1) { cols = 1; cellHeight = "180px"; }
    else if (count === 2) { cols = 2; cellHeight = "160px"; }
    else if (count === 3) { cols = 3; cellHeight = "140px"; }
    else if (count === 4) { cols = 2; cellHeight = "110px"; }
    else                  { cols = 3; cellHeight = "90px";  }

    photosHtml = `<div class="section" style="page-break-inside:avoid">
      <div class="section-title">Dokumentacja fotograficzna${photos.length > 6 ? ` (pokazano 6 z ${photos.length})` : ` (${photos.length})`}</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:5px">
        ${photoSrcs.map((src) => src
          ? `<div style="height:${cellHeight};overflow:hidden;border-radius:4px;border:1px solid #e0e0e0">
               <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
             </div>`
          : ""
        ).join("")}
      </div>
    </div>`;
  }

  // Signatures (print variant only)
  const signaturesHtml = variant === "print"
    ? `<div class="signature-row">
        <div>
          <div class="sig-line"></div>
          <div class="sig-label">Podpis serwisanta</div>
        </div>
        <div>
          <div class="sig-line"></div>
          <div class="sig-label">Podpis klienta / potwierdzenie odbioru</div>
        </div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794" />
  <title>${docTitle} ${protocol.protocolNumber}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --red:    #8B1A1A;
      --dark:   #1a1a1a;
      --mid:    #4a4a4a;
      --muted:  #777;
      --border: #e0e0e0;
      --bg:     #f9f9f9;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11.5px;
      color: var(--dark);
      background: #fff;
      padding: 22px 28px;
      line-height: 1.4;
    }

    /* ── Top bar: Nr left · Date right ── */
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 3px;
    }
    .topbar-num  { font-size: 11px; font-weight: 700; color: var(--red); letter-spacing: 0.2px; }
    .topbar-date { font-size: 10px; color: var(--muted); }

    /* ── Document title ── */
    .doc-title {
      text-align: center;
      font-size: 17px;
      font-weight: 800;
      color: var(--dark);
      letter-spacing: 1.8px;
      text-transform: uppercase;
      margin-bottom: 11px;
    }

    /* ── Header: company left · client right ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 11px;
      border-bottom: 2.5px solid var(--red);
      margin-bottom: 12px;
    }
    .company-block { display: flex; align-items: flex-start; gap: 10px; }
    .company-name  { font-size: 14px; font-weight: 700; color: var(--dark); line-height: 1.2; }
    .company-info  { font-size: 9.5px; color: var(--muted); margin-top: 4px; line-height: 1.7; }
    .client-block  { text-align: right; flex-shrink: 0; }
    .client-name   { font-size: 13px; font-weight: 700; color: var(--dark); }
    .client-info   { font-size: 9.5px; color: var(--muted); margin-top: 3px; line-height: 1.7; }

    /* ── Info grid boxes ── */
    .info-grid { display: grid; grid-template-columns: repeat(${infoGridCols}, 1fr); gap: 7px; margin-bottom: 13px; }
    .box       { border: 1px solid var(--border); border-radius: 5px; padding: 7px 10px; background: var(--bg); }
    .box-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--red); margin-bottom: 4px; }
    .box-value { font-size: 12px; font-weight: 700; color: var(--dark); line-height: 1.25; }
    .box-sub   { font-size: 9.5px; color: var(--mid); margin-top: 2px; line-height: 1.45; }

    /* ── Sections ── */
    .section       { margin-bottom: 11px; }
    .section-title {
      font-size: 8px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--red);
      border-bottom: 1.5px solid var(--red);
      padding-bottom: 3px; margin-bottom: 7px;
    }
    .text-block {
      border: 1px solid var(--border); border-radius: 5px;
      padding: 9px 12px; font-size: 11px; line-height: 1.65;
      min-height: 46px; white-space: pre-wrap;
      color: var(--dark); background: var(--bg);
    }

    /* ── Materials table ── */
    .mat-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .mat-table th { background: #f0f0f0; padding: 5px 8px; border: 1px solid var(--border); font-weight: 700; }
    .mat-table td { padding: 4px 8px; border: 1px solid var(--border); }

    /* ── Signatures ── */
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 26px; page-break-inside: avoid; }
    .sig-line  { border-bottom: 1.5px solid var(--red); height: 42px; }
    .sig-label { font-size: 9.5px; color: var(--muted); text-align: center; margin-top: 5px; }

    /* ── Print banner ── */
    .print-hint {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: var(--red); color: #fff; text-align: center;
      padding: 9px 16px; font-size: 12px; font-family: Arial, sans-serif;
      display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .print-hint strong { font-size: 13px; }

    @media screen {
      body { padding-top: ${autoPrint ? "46px" : "22px"}; }
    }
    @media print {
      html { zoom: 0.87; }
      body { padding: 0; }
      @page { size: A4; margin: 12mm 15mm; }
      .no-print { display: none !important; }
    }
  </style>
  ${autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},800);});<\/script>` : ""}
</head>
<body>
  ${autoPrint ? `
  <div class="no-print print-hint">
    <span>📄</span>
    <span>Aby ukryć URL: w oknie drukowania → <strong>Więcej ustawień</strong> → odznacz <strong>Nagłówki i stopki</strong></span>
  </div>` : ""}

  <div class="topbar">
    <span class="topbar-num">Nr ${protocol.protocolNumber}</span>
    <span class="topbar-date">${scheduledDate}</span>
  </div>
  <div class="doc-title">${docTitle}</div>

  <div class="header">
    <div class="company-block">
      ${logoHtml}
      <div>
        <div class="company-name">${company?.name ?? "SerwisPro"}</div>
        <div class="company-info">
          ${company?.address ? company.address + "<br/>" : ""}
          ${company?.phone ? "Tel: " + company.phone : ""}${company?.email ? " &middot; " + company.email : ""}
          ${company?.nip ? "<br/>NIP: " + company.nip : ""}
        </div>
      </div>
    </div>
    <div class="client-block">
      ${order.client?.name ? `<div class="client-name">${order.client.name}</div>` : ""}
      <div class="client-info">
        ${clientAddr ? clientAddr + "<br/>" : ""}
        ${order.client?.nip ? "NIP: " + order.client.nip + "<br/>" : ""}
        ${order.client?.phone ? "Tel: " + order.client.phone : ""}
      </div>
    </div>
  </div>

  <div class="info-grid">
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
      ${[locationAny?.postalCode, locationAny?.city].filter(Boolean).join(" ") ? `<div class="box-sub">${[locationAny?.postalCode, locationAny?.city].filter(Boolean).join(" ")}</div>` : ""}
    </div>` : ""}
    <div class="box">
      <div class="box-label">Serwisant</div>
      <div class="box-value" style="font-size:11px;font-weight:600">${assigneesText}</div>
    </div>
    ${hasHours ? `
    <div class="box">
      <div class="box-label">Czas pracy</div>
      <div class="box-value">${hFrom || "—"} – ${hTo || "—"}</div>
      ${hFrom && hTo ? `<div class="box-sub">Łącznie: ${calcDuration(hFrom, hTo)}</div>` : ""}
    </div>` : ""}
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

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
