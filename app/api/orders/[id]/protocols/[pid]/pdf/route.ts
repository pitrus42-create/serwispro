import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = esc(raw).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
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

// ── Status config for PDF ─────────────────────────────────────────────────
const PDF_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  OK:           { bg: "#f0fdf4", color: "#166534", label: "OK" },
  WYKONANO:     { bg: "#eff6ff", color: "#1d4ed8", label: "Wykonano" },
  NAPRAWIONO:   { bg: "#f0fdfa", color: "#0f766e", label: "Naprawiono" },
  WYMIENIONO:   { bg: "#f5f3ff", color: "#6d28d9", label: "Wymieniono" },
  SPRAWDZIC:    { bg: "#fffbeb", color: "#92400e", label: "Do sprawdzenia" },
  USTERKA:      { bg: "#fef2f2", color: "#991b1b", label: "Usterka" },
  BRAK_DOSTEPU: { bg: "#f8fafc", color: "#475569", label: "Brak dostępu" },
  ND:           { bg: "#f8fafc", color: "#94a3b8", label: "Nie dotyczy" },
  // Legacy keys
  "Do sprawdzenia": { bg: "#fffbeb", color: "#92400e", label: "Do sprawdzenia" },
  "Usterka":        { bg: "#fef2f2", color: "#991b1b", label: "Usterka" },
  "Nie dotyczy":    { bg: "#f8fafc", color: "#64748b", label: "Nie dotyczy" },
};

const STATUS_COLS_PDF = new Set([
  "Status", "Obraz", "IR / noc", "Nagrywanie", "Zasilanie", "Połączenie", "Stan",
]);

function pdfStatusBadge(val: string): string {
  const st = PDF_STATUS[val];
  if (!st) return esc(val);
  return `<span style="background:${st.bg};color:${st.color};font-size:8px;font-weight:600;padding:2px 8px;border-radius:10px;display:inline-block;white-space:nowrap">${st.label}</span>`;
}

interface PdfTokens {
  C_PRIMARY: string; C_SURFACE: string; C_BORDER: string;
  C_MUTED: string; C_MUTED2: string; R_CARD: string; SHADOW: string;
}

// Render a flat list of checklist items (shared by legacy + new format)
function renderChecklistItemsPdf(
  items: Array<{ text: string; status: string; comment: string }>,
  t: PdfTokens,
): string {
  return items.map((item) => {
    const st = PDF_STATUS[item.status] ?? PDF_STATUS.OK;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:5px 0;border-bottom:1px solid ${t.C_BORDER}">
      <span style="flex-shrink:0;background:${st.bg};color:${st.color};font-size:7.5px;font-weight:600;padding:2px 8px;border-radius:10px;margin-top:2px;white-space:nowrap">${st.label}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;line-height:1.4;color:#0f172a">${esc(item.text)}</div>
        ${item.comment ? `<div style="font-size:9px;color:${t.C_MUTED};margin-top:1px">${esc(item.comment)}</div>` : ""}
      </div>
    </div>`;
  }).join("");
}

function renderTablePdf(
  parsed: { type: string; columns: string[]; rows: Record<string, string>[] },
  t: PdfTokens,
): string {
  if (!parsed.columns?.length || !parsed.rows?.length) return "";
  const TH = `padding:5px 9px;color:white;font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;text-align:left`;
  const TD = `padding:5px 9px;font-size:10px;vertical-align:top;border-bottom:1px solid ${t.C_BORDER}`;
  const rows = parsed.rows.map((row, i) => {
    const bg = i % 2 === 1 ? `background:${t.C_SURFACE}` : "background:white";
    return `<tr style="${bg}">${parsed.columns.map((col) => {
      const val = row[col] ?? "";
      if (STATUS_COLS_PDF.has(col) && val) {
        return `<td style="${TD}">${pdfStatusBadge(val)}</td>`;
      }
      return `<td style="${TD}">${esc(val)}</td>`;
    }).join("")}</tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;border-radius:${t.R_CARD};overflow:hidden;border:1px solid ${t.C_BORDER};box-shadow:${t.SHADOW}">
    <thead><tr style="background:${t.C_PRIMARY}">${parsed.columns.map((col) =>
      `<th style="${TH}">${esc(col)}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// Main description renderer — handles new workDescription format + legacy formats
function renderDescriptionPdf(raw: string, t: PdfTokens): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);

    // New format: combined text + optional checklist
    if (parsed.type === "workDescription") {
      const parts: string[] = [];

      if (parsed.text?.trim()) {
        parts.push(`<div style="margin-bottom:${parsed.checklist?.enabled && parsed.checklist?.items?.length ? "10px" : "0"}">${markdownToHtml(parsed.text)}</div>`);
      }

      if (parsed.checklist?.enabled && parsed.checklist?.items?.length) {
        parts.push(
          `<div>` +
          `<div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${t.C_MUTED};margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid ${t.C_BORDER}">` +
          `Checklista wykonanych czynności</div>` +
          renderChecklistItemsPdf(parsed.checklist.items, t) +
          `</div>`
        );
      }

      return parts.join("") || "";
    }

    // Legacy: plain checklist
    if (parsed.type === "checklist" && parsed.items?.length) {
      return renderChecklistItemsPdf(parsed.items, t);
    }

    // Legacy: table
    if (parsed.type === "table") {
      return renderTablePdf(parsed, t);
    }
  } catch { /* plain text */ }

  return markdownToChecklist(raw);
}

function markdownToChecklist(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const bullets: string[] = [];
  const prose: string[] = [];
  for (const raw of lines) {
    const line = esc(raw).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^[-•]\s+/.test(line)) bullets.push(line.replace(/^[-•]\s+/, ""));
    else if (line.trim()) prose.push(`<p style="margin:0 0 3px">${line}</p>`);
  }
  const proseHtml = prose.length
    ? `<div style="margin-bottom:${bullets.length ? "8px" : "0"}">${prose.join("")}</div>`
    : "";
  if (!bullets.length) return proseHtml;
  const cols = bullets.length > 5 ? 2 : 1;
  const itemHtml = bullets.map((b) =>
    `<div style="display:flex;align-items:flex-start;gap:7px;padding:4px 0;border-bottom:1px solid #e8edf2">
      <span style="flex-shrink:0;width:15px;height:15px;border-radius:50%;background:#dcfce7;color:#16a34a;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px">&#10003;</span>
      <span style="font-size:10.5px;line-height:1.55;flex:1">${b}</span>
    </div>`
  ).join("");
  const grid = cols === 2
    ? `<div style="column-count:2;column-gap:20px">${itemHtml}</div>`
    : itemHtml;
  return proseHtml + grid;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId, pid } = await params;
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

  const baseUrl = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

  const TYPE_LABELS: Record<string, string> = {
    AWARIA: "Awaria", KONSERWACJA: "Konserwacja", MONTAZ: "Montaż",
    MODERNIZACJA: "Modernizacja", PRZEGLAD: "Przegląd", INSTALACJA: "Instalacja", INNE: "Inne",
  };

  const assigneesText = order.assignments.length > 0
    ? order.assignments.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")
    : "—";

  const hFrom = content.hoursFrom ?? "";
  const hTo   = content.hoursTo   ?? "";
  const hDate = content.date      ?? "";

  // Logo
  let logoSrc = "";
  if (company?.logoUrl) {
    if (download) {
      logoSrc = await fileUrlToDataUri(company.logoUrl);
    } else {
      logoSrc = company.logoUrl.startsWith("http") ? company.logoUrl : `${baseUrl}${company.logoUrl}`;
    }
  }

  // ── Design tokens ─────────────────────────────────────────────────────────
  const C_PRIMARY    = "#1a2a3a";
  const C_ACCENT     = "#1e40af";
  const C_BG         = "#f1f5f9";
  const C_SURFACE    = "#f8fafc";
  const C_BORDER     = "#dde3ec";
  const C_TEXT       = "#0f172a";
  const C_MUTED      = "#64748b";
  const C_MUTED2     = "#94a3b8";
  const C_SUCCESS    = "#16a34a";
  const C_CARD_HDR   = "#334155";
  const C_CARD_BORD  = "#475569";
  const R_CARD       = "6px";
  const SHADOW       = "0 1px 4px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04)";

  // ── Helpers ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAny  = order.client as any;
  const clientAddr = [
    clientAny?.address,
    [clientAny?.postalCode, clientAny?.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const pdfTokens: PdfTokens = { C_PRIMARY, C_SURFACE, C_BORDER, C_MUTED, C_MUTED2, R_CARD, SHADOW };
  const descriptionHtml = renderDescriptionPdf(content.description ?? (order as any).description ?? "", pdfTokens);
  const notesHtml       = markdownToHtml(content.notes ?? "");

  // Section header — thin bottom line, muted uppercase label
  const sh = (label: string, count?: number) =>
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${C_BORDER}">
      <span style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED}">${label}</span>
      ${count != null ? `<span style="font-size:7.5px;color:${C_MUTED2}">(${count})</span>` : ""}
    </div>`;

  // Info card — dark header, white body
  const card = (label: string, value: string, sub = "") =>
    `<div style="background:white;border:1px solid ${C_CARD_BORD};border-radius:${R_CARD};overflow:hidden;box-shadow:${SHADOW}">
      <div style="background:${C_CARD_HDR};padding:4px 10px">
        <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">${label}</div>
      </div>
      <div style="padding:7px 10px">
        <div style="font-size:11px;font-weight:600;color:${C_TEXT};line-height:1.3">${value}</div>
        ${sub ? `<div style="font-size:8.5px;color:${C_MUTED};margin-top:2px;line-height:1.4">${sub}</div>` : ""}
      </div>
    </div>`;

  // ── Materials ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mats     = order.materials as any[];
  const hasPrice = mats.some((m) => m.unitPrice != null);
  const TH = `padding:5px 9px;color:white;font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;text-align:left`;
  const TD = `padding:5px 9px;font-size:10.5px;vertical-align:top;border-bottom:1px solid ${C_BORDER}`;
  const materialsHtml = mats.length > 0
    ? `<div style="margin-bottom:12px;page-break-inside:avoid">
        ${sh("Użyte materiały")}
        <table style="width:100%;border-collapse:collapse;border-radius:${R_CARD};overflow:hidden;border:1px solid ${C_BORDER};box-shadow:${SHADOW}">
          <thead>
            <tr style="background:${C_PRIMARY}">
              <th style="${TH}">Materiał</th>
              <th style="${TH};text-align:right;width:60px">Ilość</th>
              <th style="${TH};width:44px">Jm.</th>
              ${hasPrice ? `<th style="${TH};text-align:right;width:68px">Cena j.</th><th style="${TH};text-align:right;width:68px">Wartość</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${mats.map((m, i) => {
              const name  = esc(m.manualName ?? m.stockItem?.name ?? "—");
              const unit  = esc(m.unit ?? m.stockItem?.unit ?? "");
              const price = m.unitPrice != null ? `${Number(m.unitPrice).toFixed(2)} zł` : "";
              const value = m.unitPrice != null && m.quantity != null
                ? `${(Number(m.quantity) * Number(m.unitPrice)).toFixed(2)} zł` : "";
              const bg = i % 2 === 1 ? `background:${C_SURFACE}` : "background:white";
              return `<tr style="${bg}">
                <td style="${TD};font-weight:500">${name}</td>
                <td style="${TD};text-align:right">${m.quantity ?? ""}</td>
                <td style="${TD};color:${C_MUTED}">${unit}</td>
                ${hasPrice ? `<td style="${TD};text-align:right;color:${C_MUTED}">${price}</td><td style="${TD};text-align:right;font-weight:600">${value}</td>` : ""}
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  // ── Checklists ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderChecklists = (order as any).checklists as Array<{
    id: string; name: string;
    items: Array<{ id: string; text: string; isChecked: boolean; note: string | null }>;
  }>;
  const checklistsHtml = orderChecklists?.length > 0
    ? `<div style="margin-bottom:12px;page-break-inside:avoid">
        ${sh("Checklist")}
        ${orderChecklists.map((cl) => `
          ${orderChecklists.length > 1
            ? `<div style="font-size:8.5px;font-weight:600;color:${C_MUTED};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.4px">${esc(cl.name)}</div>`
            : ""}
          <table style="width:100%;border-collapse:collapse;border:1px solid ${C_BORDER};border-radius:${R_CARD};overflow:hidden;margin-bottom:6px;box-shadow:${SHADOW}">
            <thead>
              <tr style="background:${C_SURFACE}">
                <th style="text-align:left;padding:5px 9px;border-bottom:1px solid ${C_BORDER};font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED}">Zadanie</th>
                <th style="text-align:center;padding:5px 9px;border-bottom:1px solid ${C_BORDER};font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED};width:60px">Status</th>
                <th style="text-align:left;padding:5px 9px;border-bottom:1px solid ${C_BORDER};font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED}">Notatka</th>
              </tr>
            </thead>
            <tbody>
              ${cl.items.map((item, i) => `
                <tr style="${i % 2 === 1 ? `background:${C_SURFACE}` : "background:white"}">
                  <td style="padding:5px 9px;font-size:10.5px;border-bottom:1px solid ${C_BORDER}">${esc(item.text)}</td>
                  <td style="padding:5px 9px;text-align:center;border-bottom:1px solid ${C_BORDER}">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${item.isChecked ? "#dcfce7" : C_BORDER};color:${item.isChecked ? C_SUCCESS : C_MUTED2};font-size:9px;font-weight:800">${item.isChecked ? "&#10003;" : "&#8211;"}</span>
                  </td>
                  <td style="padding:5px 9px;font-size:9px;color:${C_MUTED};border-bottom:1px solid ${C_BORDER}">${item.note ? esc(item.note) : ""}</td>
                </tr>`).join("")}
            </tbody>
          </table>`).join("")}
      </div>`
    : "";

  // ── Photos ────────────────────────────────────────────────────────────────
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
    const cols  = shown.length <= 2 ? shown.length : 3;
    const photoH = shown.length <= 2 ? 165 : 118;
    photosHtml = `<div style="margin-bottom:12px;page-break-inside:avoid">
      ${sh("Dokumentacja fotograficzna", photos.length)}
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px">
        ${photoSrcs.map((src, i) => src ? `
          <div style="position:relative;border-radius:${R_CARD};overflow:hidden;border:1px solid ${C_BORDER};box-shadow:${SHADOW}">
            <img src="${src}" style="width:100%;height:${photoH}px;object-fit:cover;display:block" alt="" />
            <span style="position:absolute;bottom:4px;right:5px;background:rgba(15,23,42,0.5);color:white;font-size:7px;font-weight:600;padding:1px 5px;border-radius:3px">${i + 1}</span>
          </div>` : "").join("")}
      </div>
      ${photos.length > 6 ? `<p style="font-size:8px;color:${C_MUTED2};margin-top:4px;text-align:right">Pokazano 6 z ${photos.length} zdjęć</p>` : ""}
    </div>`;
  }

  // ── Info cards ────────────────────────────────────────────────────────────
  const infoCards: string[] = [];

  const orderTypeLine = [
    TYPE_LABELS[order.type] ?? order.type,
    order.scheduledAt ? format(new Date(order.scheduledAt), "d.MM.yyyy", { locale: pl }) : null,
  ].filter(Boolean).join(" · ");

  // Order number — accent left border + dark header
  infoCards.push(
    `<div style="background:white;border:1px solid ${C_CARD_BORD};border-left:3px solid ${C_ACCENT};border-radius:${R_CARD};overflow:hidden;box-shadow:${SHADOW}">
      <div style="background:${C_CARD_HDR};padding:4px 10px">
        <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Nr zlecenia</div>
      </div>
      <div style="padding:7px 10px">
        <div style="font-size:11px;font-weight:600;color:${C_TEXT};line-height:1.3">${esc(order.orderNumber)}</div>
        ${orderTypeLine ? `<div style="font-size:8.5px;color:${C_MUTED};margin-top:2px">${orderTypeLine}</div>` : ""}
      </div>
    </div>`
  );

  if (order.location) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loc    = order.location as any;
    const locSub = [
      order.location.address,
      [loc?.postalCode, loc?.city].filter(Boolean).join(" "),
    ].filter(Boolean).join(" · ");
    infoCards.push(card("Lokalizacja", esc(order.location.name), locSub ? esc(locSub) : ""));
  }

  infoCards.push(card("Serwisant", esc(assigneesText)));

  if (hFrom || hTo) {
    const dateStr = hDate
      ? format(parseISO(hDate), "dd.MM.yyyy", { locale: pl })
      : order.scheduledAt
        ? format(new Date(order.scheduledAt), "dd.MM.yyyy", { locale: pl })
        : "";
    const timeRange = `${hFrom || "—"} – ${hTo || "—"}`;
    const timeValue = dateStr ? `${dateStr} · ${timeRange}` : timeRange;
    const timeSub = hFrom && hTo ? `Łącznie: ${calcDuration(hFrom, hTo)}` : "";
    infoCards.push(card("Czas pracy", timeValue, timeSub));
  }

  const gridCols = Math.min(infoCards.length, 4);
  const infoGridHtml = `<div style="display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:8px;margin-bottom:12px">
    ${infoCards.join("")}
  </div>`;

  // ── Header style constants ────────────────────────────────────────────────
  const HDR_LABEL = `font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED2};margin-bottom:3px`;
  const HDR_NAME  = `font-size:12px;font-weight:700;color:${C_TEXT};line-height:1.3`;
  const HDR_DATA  = `font-size:9px;color:${C_MUTED};line-height:1.85;margin-top:2px`;

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794" />
  <title>Protokół ${esc(protocol.protocolNumber)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:11px; color:${C_TEXT}; background:${C_BG}; line-height:1.5; font-feature-settings:'kern' 1,'liga' 1; text-rendering:optimizeLegibility; }
    .frame { background:white; max-width:794px; margin:0 auto; padding:22px 26px; }
    .text-block { background:${C_SURFACE}; border:1px solid ${C_BORDER}; border-radius:${R_CARD}; padding:10px 13px; font-size:11px; line-height:1.75; min-height:32px; color:${C_TEXT}; box-shadow:${SHADOW}; }
    .text-block strong { font-weight:700; }
    .print-hint { position:fixed;top:0;left:0;right:0;z-index:9999;background:${C_PRIMARY};color:white;text-align:center;padding:10px 16px;font-size:12px;font-family:'Inter','Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px; }
    @media screen { body { padding:${autoPrint ? "52px" : "14px"} 14px 24px; } }
    @media print {
      body { padding:0; font-size:10.5px; zoom:${printZoom}; background:white; }
      .frame { padding:0; }
      @page { size:A4; margin:11mm 13mm; }
      .no-print { display:none !important; }
    }
  </style>
  ${autoPrint ? `<script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});<\/script>` : ""}
</head>
<body>
${autoPrint ? `<div class="no-print print-hint">&#128196; Aby ukryć URL i datę: <strong>Więcej ustawień &#8594; odznacz Nagłówki i stopki</strong></div>` : ""}
<div class="frame">

  <!-- ═══ HEADER ═══════════════════════════════════════════════════════════ -->
  <!--
    3-column table: [Wykonawca] [spacer] [Zamawiajacy]
    Logo goes in its own row above so company name and client name
    are always in the same <tr> — guaranteed optical alignment.
  -->
  <table style="width:100%;border-collapse:collapse">
    ${logoSrc ? `<tr>
      <td style="padding-bottom:5px;vertical-align:bottom">
        <img src="${logoSrc}" alt="" style="max-height:46px;max-width:130px;object-fit:contain;display:block" />
      </td>
      <td style="width:100%"></td>
      <td style="padding-bottom:5px"></td>
    </tr>` : ""}
    <tr>
      <td style="vertical-align:top;padding-bottom:12px;white-space:nowrap">
        <div style="${HDR_LABEL}">Wykonawca</div>
        <div style="${HDR_NAME}">${esc(company?.name ?? "SerwisPro")}</div>
        <div style="${HDR_DATA}">
          ${company?.nip     ? `NIP: ${esc(company.nip)}<br>` : ""}
          ${company?.address ? `${esc(company.address)}<br>` : ""}
          ${company?.phone   ? `Tel: ${esc(company.phone)}<br>` : ""}
          ${company?.email   ? `${esc(company.email)}` : ""}
        </div>
      </td>
      <td style="width:100%"></td>
      <td style="vertical-align:top;text-align:right;padding-bottom:12px;white-space:nowrap">
        ${order.client ? `
        <div style="${HDR_LABEL}">Zamawiający</div>
        <div style="${HDR_NAME}">${esc(order.client.name ?? "")}</div>
        <div style="${HDR_DATA}">
          ${clientAny?.nip     ? `NIP: ${esc(clientAny.nip)}<br>` : ""}
          ${clientAddr         ? `${esc(clientAddr)}<br>` : ""}
          ${order.client.phone ? `Tel: ${esc(order.client.phone)}<br>` : ""}
          ${order.client.email ? `${esc(order.client.email)}` : ""}
        </div>` : ""}
      </td>
    </tr>
  </table>
  <div style="height:2px;background:${C_PRIMARY};margin-bottom:14px;border-radius:1px"></div>

  <!-- ═══ ZLECENIE ══════════════════════════════════════════════════════════ -->
  <div style="margin-bottom:12px">
    <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED};margin-bottom:7px">Zlecenie serwisowe</div>
    ${infoGridHtml}
  </div>

  <!-- ═══ CHECKLIST ════════════════════════════════════════════════════════ -->
  ${checklistsHtml}

  <!-- ═══ OPIS PRAC ════════════════════════════════════════════════════════ -->
  <div style="margin-bottom:12px">
    ${sh("Opis wykonanych prac")}
    <div class="text-block">${descriptionHtml || `<span style='color:${C_MUTED2};font-style:italic'>Brak opisu</span>`}</div>
  </div>

  <!-- ═══ MATERIALY ════════════════════════════════════════════════════════ -->
  ${materialsHtml}

  <!-- ═══ DOKUMENTACJA FOTOGRAFICZNA ══════════════════════════════════════ -->
  ${photosHtml}

  <!-- ═══ UWAGI ════════════════════════════════════════════════════════════ -->
  ${notesHtml ? `<div style="margin-bottom:12px">
    ${sh("Uwagi / zalecenia")}
    <div class="text-block">${notesHtml}</div>
  </div>` : ""}

</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
