import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { readFile } from "fs/promises";
import pathModule from "path";

type Params = { params: Promise<{ id: string; pid: string }> };

async function fileUrlToDataUri(fileUrl: string): Promise<string> {
  try {
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp", svg: "image/svg+xml",
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
  } catch { return ""; }
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

function markdownToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    let line = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // bold: **text**
    line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // bullet list
    if (/^[-•]\s+/.test(line)) {
      if (!inList) { out.push("<ul style='margin:4px 0 4px 16px;padding:0'>"); inList = true; }
      out.push(`<li style='margin:2px 0'>${line.replace(/^[-•]\s+/, "")}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(line === "" ? "<br>" : `<p style='margin:2px 0'>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, pid } = await params;
  const variant = (req.nextUrl.searchParams.get("variant") ?? "print") as "print" | "report";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const ua = req.headers.get("user-agent") ?? "";
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  const printZoom = isMobile ? 0.70 : 0.88;

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
        checklists: {
          include: { items: { orderBy: { itemOrder: "asc" } } },
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

  const BRAND = "#1a2a3a";

  const assigneesText = order.assignments.length > 0
    ? order.assignments.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")
    : "—";

  const hFrom = content.hoursFrom ?? "";
  const hTo = content.hoursTo ?? "";

  // Logo
  let logoSrc = "";
  if (company?.logoUrl) {
    if (download) {
      logoSrc = await fileUrlToDataUri(company.logoUrl);
    } else {
      logoSrc = company.logoUrl.startsWith("http") ? company.logoUrl : `${baseUrl}${company.logoUrl}`;
    }
  }

  // Materials
  const materialsHtml = order.materials.length > 0
    ? `<div class="section">
        <div class="section-title">Użyte materiały</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:5px 8px;border:1px solid #c8d4de;font-weight:600">Materiał</th>
              <th style="text-align:right;padding:5px 8px;border:1px solid #c8d4de;font-weight:600">Ilość</th>
              <th style="text-align:left;padding:5px 8px;border:1px solid #c8d4de;font-weight:600">Jm.</th>
            </tr>
          </thead>
          <tbody>
            ${order.materials.map((m) => `
              <tr>
                <td style="padding:5px 8px;border:1px solid #c8d4de">${m.stockItem?.name ?? "—"}</td>
                <td style="padding:5px 8px;border:1px solid #c8d4de;text-align:right">${m.quantity}</td>
                <td style="padding:5px 8px;border:1px solid #c8d4de">${m.stockItem?.unit ?? ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  // Checklists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderChecklists = (order as any).checklists as Array<{
    id: string; name: string;
    items: Array<{ id: string; text: string; isChecked: boolean; note: string | null }>;
  }>;
  const checklistsHtml = orderChecklists?.length > 0
    ? `<div class="section" style="page-break-inside:avoid">
        <div class="section-title">Checklist</div>
        ${orderChecklists.map((cl) => `
          <div style="margin-bottom:8px">
            ${orderChecklists.length > 1 ? `<div style="font-size:10px;font-weight:600;color:#444;margin-bottom:4px">${cl.name}</div>` : ""}
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="background:#e8edf2">
                  <th style="text-align:left;padding:5px 10px;border:1px solid #c8d4de;font-weight:600">Zadanie</th>
                  <th style="text-align:center;padding:5px 10px;border:1px solid #c8d4de;font-weight:600;width:80px">Wykonano</th>
                  <th style="text-align:left;padding:5px 10px;border:1px solid #c8d4de;font-weight:600">Notatka</th>
                </tr>
              </thead>
              <tbody>
                ${cl.items.map((item) => `
                  <tr>
                    <td style="padding:5px 10px;border:1px solid #c8d4de">${item.text}</td>
                    <td style="padding:5px 10px;border:1px solid #c8d4de;text-align:center;font-weight:700;color:${item.isChecked ? "#16a34a" : "#999"}">${item.isChecked ? "✓" : "—"}</td>
                    <td style="padding:5px 10px;border:1px solid #c8d4de;color:#555">${item.note ?? ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `).join("")}
      </div>`
    : "";

  // Photos
  let photosHtml = "";
  if (photos.length > 0) {
    const shown = photos.slice(0, 6);
    const photoSrcs = await Promise.all(
      shown.map(async (p) => {
        if (download) {
          const dataUri = await fileUrlToDataUri(p.fileUrl);
          return dataUri || (p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`);
        }
        return p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`;
      })
    );
    const cols = shown.length === 1 ? 1 : shown.length === 2 ? 2 : shown.length === 4 ? 4 : 3;
    const photoHeight = shown.length === 1 ? 220 : shown.length === 2 ? 200 : shown.length === 3 ? 185 : shown.length === 4 ? 175 : 150;
    const imgStyle = `width:100%;height:${photoHeight}px;display:block;object-fit:contain;background:#e8edf2;border-radius:3px;border:1px solid #c8d4de`;
    photosHtml = `<div class="section" style="page-break-inside:avoid">
      <div class="section-title">Dokumentacja fotograficzna (${photos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px">
        ${photoSrcs.map((src) => src
          ? `<img src="${src}" style="${imgStyle}" alt="" />`
          : ""
        ).join("")}
      </div>
      ${photos.length > 6 ? `<p style="font-size:9px;color:#777;margin-top:6px;text-align:right">Pokazano 6 z ${photos.length} zdjęć</p>` : ""}
    </div>`;
  }

  // Signatures
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



  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAny = order.client as any;

  const infoBoxCount = 2 + (order.location ? 1 : 0) + (hFrom || hTo ? 1 : 0);
  const infoGridCols = infoBoxCount <= 2 ? 2 : infoBoxCount === 3 ? 3 : 4;

  const descriptionHtml = markdownToHtml(content.description ?? (order as any).description ?? "");
  const notesHtml = markdownToHtml(content.notes ?? "");

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794" />
  <title>Protokół ${protocol.protocolNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #e5e7eb; padding: 20px; }
    .protocol-frame { background: white !important; border: 1px solid #c8d4de; border-radius: 6px; padding: 24px 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .box { background: #e8edf2 !important; border: 1px solid #c8d4de; border-radius: 4px; padding: 8px 10px; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND}; margin-bottom: 3px; font-weight: 700; }
    .box-value { font-size: 12px; font-weight: 600; line-height: 1.3; color: #1a1a1a; }
    .box-sub { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4; }
    .section { margin-bottom: 12px; }
    .section-title { background: #374151 !important; color: white !important; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 7px 12px; margin-bottom: 8px; border-radius: 2px; }
    .text-block { background: #e8edf2 !important; border: 1px solid #c8d4de; border-radius: 4px; padding: 10px 12px; font-size: 11.5px; line-height: 1.7; min-height: 52px; color: #1a1a1a; }
    .text-block ul { margin: 4px 0 4px 16px; }
    .text-block li { margin: 2px 0; }
    .text-block strong { font-weight: 700; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1.5px solid ${BRAND}; height: 48px; }
    .sig-label { font-size: 10px; color: #555; text-align: center; margin-top: 6px; }
    @media screen { body { padding-top: ${autoPrint ? "48px" : "0"}; } }
    .print-hint { position:fixed;top:0;left:0;right:0;z-index:9999;background:${BRAND};color:white;text-align:center;padding:10px 16px;font-size:13px;font-family:'Inter',Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px; }
    .print-hint strong { font-size: 14px; }
    @media print {
      body { padding: 0; font-size: 11px; zoom: ${printZoom}; background: white !important; }
      .protocol-frame { border: none; border-radius: 0; padding: 0; box-shadow: none; }
      @page { size: A4; margin: 12mm 15mm; }
      .no-print { display: none !important; }
    }
  </style>
  ${autoPrint ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 800); });<\/script>` : ""}
</head>
<body>
  ${autoPrint ? `
  <div class="no-print print-hint">
    <span>📄</span>
    <span>Aby ukryć datę i adres URL: w oknie drukowania kliknij <strong>„Więcej ustawień"</strong> → odznacz <strong>„Nagłówki i stopki"</strong> → kliknij Zapisz</span>
  </div>` : ""}

  <div class="protocol-frame">
  <!-- Dane wykonawcy | Dane kontrahenta -->
  ${(() => {
    const clientAddr = [clientAny?.address, [clientAny?.postalCode, clientAny?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const dataRow = (l: string, r: string) =>
      `<tr><td style="font-size:10px;color:#444;white-space:nowrap;padding:1px 0;vertical-align:top">${l}</td><td></td><td style="font-size:10px;color:#444;white-space:nowrap;padding:1px 0;vertical-align:top">${r}</td></tr>`;
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      ${logoSrc ? `<tr><td style="padding-bottom:4px"><img src="${logoSrc}" alt="" style="max-height:72px;max-width:144px;object-fit:contain;display:block"/></td><td style="width:100%"></td><td></td></tr>` : ""}
      <tr>
        <td style="font-size:12px;font-weight:700;color:#1a1a1a;white-space:nowrap;padding:1px 0;vertical-align:top">${company?.name ?? "SerwisPro"}</td>
        <td style="width:100%"></td>
        <td style="font-size:12px;font-weight:700;color:#1a1a1a;white-space:nowrap;padding:1px 0;vertical-align:top">${order.client?.name ?? "—"}</td>
      </tr>
      ${(company?.nip || order.client?.nip) ? dataRow(company?.nip ? `NIP: ${company.nip}` : "", order.client?.nip ? `NIP: ${order.client.nip}` : "") : ""}
      ${(company?.address || clientAddr) ? dataRow(company?.address ?? "", clientAddr) : ""}
      ${(company?.email || order.client?.email) ? dataRow(company?.email ?? "", order.client?.email ?? "") : ""}
      ${(company?.phone || order.client?.phone) ? dataRow(company?.phone ? `Tel: ${company.phone}` : "", order.client?.phone ? `Tel: ${order.client.phone}` : "") : ""}
    </table>`;
  })()}

  <!-- Zlecenie -->
  <div class="section">
    <div class="section-title">Zlecenie</div>
    <div style="display:grid;grid-template-columns:repeat(${infoGridCols},1fr);gap:8px">
      ${(() => {
        const sub = [
          TYPE_LABELS[order.type] ?? order.type,
          order.scheduledAt ? `Termin: ${format(new Date(order.scheduledAt), "d.MM.yyyy", { locale: pl })}` : null,
        ].filter(Boolean).join(" · ");
        return `<div class="box">
          <div class="box-label">Nr zlecenia</div>
          <div class="box-value">${order.orderNumber}</div>
          ${sub ? `<div class="box-sub">${sub}</div>` : ""}
        </div>`;
      })()}
      ${order.location ? (() => {
        const loc = order.location as any;
        const sub = [
          order.location.address,
          [loc?.postalCode, loc?.city].filter(Boolean).join(" "),
        ].filter(Boolean).join(" · ");
        return `<div class="box">
          <div class="box-label">Lokalizacja</div>
          <div class="box-value">${order.location.name}</div>
          ${sub ? `<div class="box-sub">${sub}</div>` : ""}
        </div>`;
      })() : ""}
      <div class="box">
        <div class="box-label">Serwisant</div>
        <div class="box-value" style="font-size:11px">${assigneesText}</div>
      </div>
      ${hFrom || hTo ? (() => {
        const sub = [
          `${hFrom || "—"} – ${hTo || "—"}`,
          hFrom && hTo ? `Łącznie: ${calcDuration(hFrom, hTo)}` : null,
        ].filter(Boolean).join(" · ");
        return `<div class="box">
          <div class="box-label">Czas pracy</div>
          <div class="box-value">${format(order.scheduledAt ? new Date(order.scheduledAt) : now, "d MMMM", { locale: pl })}</div>
          ${sub ? `<div class="box-sub">${sub}</div>` : ""}
        </div>`;
      })() : ""}
    </div>
  </div>

  <!-- Checklist (opcjonalnie) -->
  ${checklistsHtml}

  <!-- Opis prac -->
  <div class="section">
    <div class="section-title">Opis wykonanych prac</div>
    <div class="text-block">${descriptionHtml}</div>
  </div>

  <!-- Zdjęcia -->
  ${photosHtml}

  ${notesHtml ? `
  <div class="section">
    <div class="section-title">Uwagi / zalecenia</div>
    <div class="text-block">${notesHtml}</div>
  </div>` : ""}

  ${materialsHtml}
  ${signaturesHtml}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
