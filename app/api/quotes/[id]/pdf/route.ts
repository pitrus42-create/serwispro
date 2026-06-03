import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { readFile } from "fs/promises";
import pathModule from "path";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function fileUrlToDataUri(fileUrl: string): Promise<string> {
  try {
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    if (fileUrl.startsWith("http")) {
      const res = await fetch(fileUrl);
      if (!res.ok) return "";
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      return `data:${ct.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
    const rel = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
    const bytes = await readFile(pathModule.join(process.cwd(), "public", rel));
    const ext = (rel.split(".").pop() ?? "jpg").toLowerCase();
    return `data:${mimeMap[ext] ?? "image/jpeg"};base64,${bytes.toString("base64")}`;
  } catch { return ""; }
}

const SERVICE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV", ALARM: "System alarmowy", BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon / wideodomofon", SIEC: "Sieć LAN / Wi-Fi", AWARIA: "Naprawa awarii",
  KONSERWACJA: "Konserwacja systemu", MODERNIZACJA: "Modernizacja systemu", INNE: "Inne usługi",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  SPRZET: "Sprzęt", ROBOCIZNA: "Robocizna", KONFIGURACJA: "Konfiguracja",
  MATERIALY: "Materiały", INNE: "Inne",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const download = req.nextUrl.searchParams.get("download") === "1";

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { packageType: "asc" },
        include: { items: { orderBy: { id: "asc" } } },
      },
      acceptance: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const company = await prisma.companySettings.findUnique({ where: { id: 1 } });
  const baseUrl = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;

  let logoSrc = "";
  if (company?.logoUrl) {
    logoSrc = download
      ? await fileUrlToDataUri(company.logoUrl)
      : company.logoUrl.startsWith("http") ? company.logoUrl : `${baseUrl}${company.logoUrl}`;
  }

  // Tokens
  const C_PRIMARY = "#1a2a3a";
  const C_ACCENT  = "#1e3a5f";
  const C_BG      = "#f1f5f9";
  const C_SURFACE = "#f8fafc";
  const C_BORDER  = "#dde3ec";
  const C_TEXT    = "#0f172a";
  const C_MUTED   = "#64748b";
  const C_MUTED2  = "#94a3b8";
  const R_CARD    = "8px";
  const SHADOW    = "0 1px 4px rgba(0,0,0,0.07)";

  const today = format(new Date(), "d MMMM yyyy", { locale: pl });
  const validDate = quote.validUntil
    ? format(new Date(quote.validUntil), "d MMMM yyyy", { locale: pl })
    : "";
  const serviceLabel = SERVICE_LABELS[quote.serviceType ?? ""] ?? (quote.serviceType ?? "");

  // Packages in order: MINIMUM, STANDARD, PRO
  const pkgOrder = ["MINIMUM", "STANDARD", "PRO"];
  const packages = pkgOrder.map(t => quote.packages.find(p => p.packageType === t)).filter(Boolean) as typeof quote.packages;

  const PKG_COLORS = {
    MINIMUM:  { hdr: "#475569", accent: "#94a3b8", bg: "#f8fafc", badge: "#e2e8f0", badgeText: "#475569" },
    STANDARD: { hdr: "#1e3a5f", accent: "#2563eb", bg: "#eff6ff", badge: "#dbeafe", badgeText: "#1e40af" },
    PRO:      { hdr: "#78350f", accent: "#d97706", bg: "#fffbeb", badge: "#fef3c7", badgeText: "#92400e" },
  } as Record<string, { hdr: string; accent: string; bg: string; badge: string; badgeText: string }>;

  const renderItems = (items: typeof packages[0]["items"]) => {
    if (!items.length) return `<p style="font-size:10px;color:${C_MUTED2};font-style:italic;padding:8px 0">Brak pozycji</p>`;
    return items
      .filter(i => i.isVisibleToClient)
      .map((item, idx) => {
        const lineGross = item.grossPrice * item.quantity;
        const bg = idx % 2 === 1 ? C_SURFACE : "white";
        return `<div style="padding:7px 8px;background:${bg};border-bottom:1px solid ${C_BORDER}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-size:10px;font-weight:600;color:${C_TEXT};line-height:1.3">${esc(item.name)}</div>
              ${item.modelName ? `<div style="font-size:8.5px;color:${C_MUTED};margin-top:1px;font-style:italic">${esc(item.modelName)}</div>` : ""}
              ${item.description ? `<div style="font-size:9px;color:${C_MUTED};margin-top:1px">${esc(item.description)}</div>` : ""}
              <div style="font-size:8px;color:${C_MUTED2};margin-top:2px">${esc(ITEM_TYPE_LABELS[item.itemType] ?? item.itemType)} · ${item.quantity} ${esc(item.unit)} × ${item.netPrice.toFixed(2)} zł netto</div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${C_TEXT};white-space:nowrap;flex-shrink:0">${lineGross.toFixed(2)} zł</div>
          </div>
        </div>`;
      }).join("") || `<p style="font-size:10px;color:${C_MUTED2};font-style:italic;padding:8px">Brak pozycji widocznych</p>`;
  };

  const renderPackage = (pkg: typeof packages[0]) => {
    const c = PKG_COLORS[pkg.packageType] ?? PKG_COLORS.MINIMUM;
    const isRec = pkg.isRecommended;
    const discountedGross = pkg.discount
      ? pkg.grossTotal * (1 - pkg.discount / 100)
      : pkg.grossTotal;

    return `
    <div style="border:2px solid ${isRec ? c.accent : C_BORDER};border-radius:${R_CARD};overflow:hidden;box-shadow:${isRec ? "0 4px 12px rgba(37,99,235,0.15)" : SHADOW};position:relative">
      ${isRec ? `<div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:${c.accent};color:white;font-size:7.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;padding:3px 12px;border-radius:0 0 6px 6px;white-space:nowrap">★ Rekomendowany</div>` : ""}
      <div style="background:${c.hdr};padding:${isRec ? "22px 14px 10px" : "10px 14px"};text-align:center">
        <div style="display:inline-block;background:${c.badge};color:${c.badgeText};font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:3px 10px;border-radius:999px;margin-bottom:4px">${esc(pkg.packageType)}</div>
        <div style="font-size:14px;font-weight:700;color:white;line-height:1.2">${esc(pkg.name)}</div>
        ${pkg.description ? `<div style="font-size:9.5px;color:rgba(255,255,255,0.8);margin-top:3px;line-height:1.4">${esc(pkg.description)}</div>` : ""}
      </div>

      <div style="background:${c.bg}">
        ${renderItems(pkg.items)}
      </div>

      <div style="background:${c.bg};padding:10px 14px;border-top:2px solid ${isRec ? c.accent : C_BORDER}">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:${C_MUTED};margin-bottom:2px">
          <span>Netto</span>
          <span>${pkg.netTotal.toFixed(2)} zł</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:${C_TEXT}">
          <span>Brutto</span>
          <span style="color:${isRec ? c.accent : C_TEXT}">${discountedGross.toFixed(2)} zł</span>
        </div>
        ${pkg.discount ? `<div style="font-size:8.5px;color:#16a34a;text-align:right;margin-top:1px">Rabat ${pkg.discount}%</div>` : ""}
      </div>

      ${(pkg.includes || pkg.excludes) ? `
      <div style="padding:8px 14px 10px;background:white;border-top:1px solid ${C_BORDER};font-size:9px;line-height:1.6">
        ${pkg.includes ? `<div style="margin-bottom:4px"><span style="font-weight:700;color:#16a34a">✓ Wliczone:</span> <span style="color:${C_MUTED}">${esc(pkg.includes)}</span></div>` : ""}
        ${pkg.excludes ? `<div><span style="font-weight:700;color:#dc2626">✗ Nie wliczone:</span> <span style="color:${C_MUTED}">${esc(pkg.excludes)}</span></div>` : ""}
      </div>` : ""}
    </div>`;
  };

  const acceptanceHtml = quote.acceptance ? `
  <div style="margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:${R_CARD};padding:12px 16px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:#15803d">✓ Oferta zaakceptowana — Pakiet ${esc(quote.acceptance.acceptedPackage)}</div>
  </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=860" />
  <title>Oferta ${esc(quote.quoteNumber)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:11px; color:${C_TEXT}; background:${C_BG}; line-height:1.5; }
    .frame { background:white; max-width:860px; margin:0 auto; padding:24px 28px; }
    @media screen { body { padding:14px 14px 32px; } }
    @media print {
      body { padding:0; background:white; zoom:0.85; }
      .frame { padding:0; }
      .no-print { display:none !important; }
      @page { size:A4; margin:12mm 13mm; }
    }
  </style>
</head>
<body>
<div class="frame">

  <!-- HEADER -->
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:20px;padding-bottom:14px">
    <div>
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED2};margin-bottom:3px">Wystawia</div>
      <div style="font-size:14px;font-weight:800;color:${C_TEXT}">${esc(company?.name ?? "All-Secure")}</div>
      <div style="font-size:9px;color:${C_MUTED};line-height:1.9;margin-top:3px">
        ${company?.nip ? `NIP: ${esc(company.nip)}<br>` : ""}
        ${company?.address ? `${esc(company.address)}<br>` : ""}
        ${company?.phone ? `Tel: ${esc(company.phone)}<br>` : ""}
        ${company?.email ? `${esc(company.email)}` : ""}
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center">
      ${logoSrc ? `<img src="${logoSrc}" style="max-height:70px;max-width:200px;object-fit:contain" alt="" />` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED2};margin-bottom:3px">Dla</div>
      <div style="font-size:14px;font-weight:800;color:${C_TEXT}">${esc(quote.clientName ?? "—")}</div>
      <div style="font-size:9px;color:${C_MUTED};line-height:1.9;margin-top:3px">
        ${quote.clientCompany ? `${esc(quote.clientCompany)}<br>` : ""}
        ${quote.clientNip ? `NIP: ${esc(quote.clientNip)}<br>` : ""}
        ${quote.clientPhone ? `Tel: ${esc(quote.clientPhone)}<br>` : ""}
        ${quote.clientEmail ? `${esc(quote.clientEmail)}<br>` : ""}
        ${quote.investmentAddress ? `${esc(quote.investmentAddress)}` : ""}
      </div>
    </div>
  </div>
  <div style="height:3px;background:${C_PRIMARY};margin-bottom:16px;border-radius:1px"></div>

  <!-- QUOTE META -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
    ${[
      ["Numer oferty", esc(quote.quoteNumber)],
      ["Data wystawienia", today],
      ...(validDate ? [["Ważna do", validDate]] : []),
      ["Typ usługi", esc(serviceLabel)],
    ].map(([label, value]) => `
      <div style="background:${C_SURFACE};border:1px solid ${C_BORDER};border-radius:${R_CARD};padding:10px 12px">
        <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED2};margin-bottom:3px">${label}</div>
        <div style="font-size:11px;font-weight:700;color:${C_TEXT}">${value}</div>
      </div>`
    ).join("")}
  </div>

  <!-- SUMMARY -->
  ${quote.summary ? `
  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:${R_CARD};padding:12px 16px;margin-bottom:20px">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#1e40af;margin-bottom:4px">Zakres oferty</div>
    <div style="font-size:11px;color:${C_TEXT};line-height:1.6">${esc(quote.summary)}</div>
  </div>` : ""}

  <!-- PACKAGES -->
  <div style="margin-bottom:8px">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED};margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid ${C_BORDER}">Warianty oferty</div>
    <div style="display:grid;grid-template-columns:repeat(${packages.length},1fr);gap:12px">
      ${packages.map(renderPackage).join("")}
    </div>
  </div>

  ${acceptanceHtml}

  <!-- CONDITIONS -->
  ${quote.conditions ? `
  <div style="margin-top:20px;padding:12px 16px;background:${C_SURFACE};border:1px solid ${C_BORDER};border-radius:${R_CARD}">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C_MUTED};margin-bottom:6px">Warunki realizacji</div>
    <div style="font-size:10px;color:${C_TEXT};line-height:1.7;white-space:pre-line">${esc(quote.conditions)}</div>
  </div>` : ""}

  <!-- FOOTER -->
  <div style="margin-top:20px;padding-top:12px;border-top:1px solid ${C_BORDER};font-size:8.5px;color:${C_MUTED};text-align:center;line-height:1.6">
    <p>Niniejsza oferta została przygotowana indywidualnie po analizie przesłanych danych i zdjęć.</p>
    <p style="margin-top:2px">${esc(company?.name ?? "All-Secure")} · ${company?.phone ?? ""} · ${company?.email ?? ""}</p>
    ${validDate ? `<p style="margin-top:2px">Oferta ważna do: <strong>${validDate}</strong></p>` : ""}
  </div>

  <!-- PRINT BUTTON (screen only) -->
  <div class="no-print" style="margin-top:20px;text-align:center">
    <button onclick="window.print()" style="background:${C_PRIMARY};color:white;border:none;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
      🖨️ Drukuj / Zapisz jako PDF
    </button>
  </div>

</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
