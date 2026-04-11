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
        .map((a) => `${a.user.firstName} ${a.user.lastName}${a.isLead ? " (odp.)" : ""}`)
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

  // Photos (report only) — embed as base64 when downloading
  let photosHtml = "";
  if (variant === "report" && photos.length > 0) {
    const photoSrcs = await Promise.all(
      photos.slice(0, 6).map(async (p) => {
        if (download) {
          const dataUri = await fileUrlToDataUri(p.fileUrl, baseUrl);
          // fallback to direct URL if conversion fails
          return dataUri || (p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`);
        }
        return p.fileUrl.startsWith("http") ? p.fileUrl : `${baseUrl}${p.fileUrl}`;
      })
    );
    photosHtml = `<div class="section">
      <div class="section-title">Dokumentacja fotograficzna (${photos.length})</div>
      <div class="photo-grid">
        ${photoSrcs.map((src) => src
          ? `<div class="photo-wrap"><img src="${src}" class="photo-thumb" alt="" /></div>`
          : ""
        ).join("")}
      </div>
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

  // Grid layout: 2 cols if no hours, 3 cols if hours present
  const infoGridStyle = hoursBox
    ? `display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px`
    : `display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle} ${protocol.protocolNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: white; padding: 20px 30px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1e40af; padding-bottom: 14px; margin-bottom: 14px; }
    .header-left { display: flex; align-items: flex-start; gap: 12px; }
    .company-name { font-size: 16px; font-weight: 700; color: #1e40af; line-height: 1.2; }
    .company-details { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.55; }
    .doc-info { text-align: right; flex-shrink: 0; }
    .doc-number { font-size: 17px; font-weight: 700; color: #111; }
    .doc-type { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
    .doc-date { font-size: 10px; color: #555; margin-top: 4px; }
    .box { border: 1px solid #e5e7eb; border-radius: 5px; padding: 8px 10px; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 3px; font-weight: 600; }
    .box-value { font-size: 12px; font-weight: 600; line-height: 1.3; }
    .box-sub { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.4; }
    .section { margin-bottom: 11px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 7px; }
    .text-block { border: 1px solid #e5e7eb; border-radius: 5px; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; min-height: 52px; white-space: pre-wrap; color: #333; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .photo-wrap { aspect-ratio: 4/3; overflow: hidden; border-radius: 4px; border: 1px solid #e5e7eb; background: #f9fafb; }
    .photo-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1px solid #333; height: 48px; }
    .sig-label { font-size: 10px; color: #555; text-align: center; margin-top: 6px; }
    .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 7px; font-size: 9px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 0; font-size: 11px; }
      @page { margin: 12mm 15mm; size: A4; }
    }
  </style>
</head>
<body>
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

  <div style="${infoGridStyle}">
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
    </div>
    <div class="box">
      <div class="box-label">Serwisant(ci)</div>
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
  ${photosHtml}
  ${signaturesHtml}

  <div class="footer">
    ${docTitle} &nbsp;&middot;&nbsp; Wygenerowany ${format(now, "d.MM.yyyy HH:mm", { locale: pl })} &nbsp;&middot;&nbsp; ${company?.name ?? "SerwisPro"}
  </div>
</body>
</html>`;

  // --- PDF download via Puppeteer ---
  if (download) {
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--single-process",
          "--no-zygote",
        ],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        // Give fonts / images a moment to settle
        await new Promise((r) => setTimeout(r, 400));
        const pdfBytes = await page.pdf({
          format: "A4",
          margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
          printBackground: true,
        });
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${protocol.protocolNumber}.pdf"`,
          },
        });
      } finally {
        await browser.close();
      }
    } catch (err) {
      console.error("Puppeteer PDF error:", err);
      // Fallback: open HTML in browser (user can use Ctrl+P → Save as PDF)
      return new NextResponse(
        JSON.stringify({
          error: "pdf_unavailable",
          message: "Generowanie PDF nie powiodło się. Użyj przycisku Podgląd i wydrukuj jako PDF (Ctrl+P → Zapisz jako PDF).",
          previewUrl: `/api/orders/${orderId}/protocols/${pid}/pdf?variant=${variant}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // --- HTML preview ---
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
