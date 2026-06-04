"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Plus, Search, FileText, Phone, Mail, Image, CheckCircle2, Clock, X,
  ChevronDown, Copy, ExternalLink, Check, MapPin, Calendar, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NOWE: "Nowe", W_ANALIZIE: "W analizie", BRAKUJE_INFO: "Brakuje informacji",
  GOTOWE_DO_WYCENY: "Gotowe do wyceny", WYCENA_PRZYGOTOWANA: "Wycena przygotowana",
  WYCENA_WYSLANA: "Wycena wysłana", OCZEKUJE_NA_DECYZJE: "Oczekuje na decyzję",
  ZAAKCEPTOWANE: "Zaakceptowane", ODRZUCONE: "Odrzucone", PRZEKSZTALCONE: "Przekształcone",
  ZAPLANOWANO_MONTAZ: "Zaplanowano montaż", ZAMKNIETE: "Zamknięte",
};

const STATUS_COLORS: Record<string, string> = {
  NOWE: "bg-blue-100 text-blue-800", W_ANALIZIE: "bg-amber-100 text-amber-800",
  BRAKUJE_INFO: "bg-orange-100 text-orange-800", GOTOWE_DO_WYCENY: "bg-purple-100 text-purple-800",
  WYCENA_PRZYGOTOWANA: "bg-violet-100 text-violet-800", WYCENA_WYSLANA: "bg-indigo-100 text-indigo-800",
  OCZEKUJE_NA_DECYZJE: "bg-yellow-100 text-yellow-800", ZAAKCEPTOWANE: "bg-green-100 text-green-800",
  ODRZUCONE: "bg-red-100 text-red-800", PRZEKSZTALCONE: "bg-teal-100 text-teal-800",
  ZAPLANOWANO_MONTAZ: "bg-cyan-100 text-cyan-800", ZAMKNIETE: "bg-gray-100 text-gray-600",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV", ALARM: "Alarm", BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon/wideofon", SIEC: "Sieć LAN/Wi-Fi", AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja", MODERNIZACJA: "Modernizacja", INNE: "Inne",
};

const TAG_COLORS: Record<string, string> = {
  "Budżetowy system":      "bg-gray-100 text-gray-600",
  "Klient premium":        "bg-purple-100 text-purple-800",
  "Pilny termin":          "bg-red-100 text-red-700",
  "Brakuje zdjęć":         "bg-yellow-100 text-yellow-700",
  "Brakuje informacji":    "bg-orange-100 text-orange-700",
  "Wymaga wizji lokalnej": "bg-blue-100 text-blue-700",
  "Nowa instalacja":       "bg-teal-100 text-teal-700",
  "Modernizacja":          "bg-teal-100 text-teal-700",
};

const SCORE_BADGE: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700",
  MEDIUM: "",
  LOW: "",
};

type TabKey = "AKTYWNE" | "WYCENA" | "ZAAKCEPTOWANE" | "ZAMKNIETE" | "ZARCHIWIZOWANE" | "USUNIETE" | "WSZYSTKIE";

const TABS: { key: TabKey; label: string; statuses: string[] | null; filter?: string }[] = [
  { key: "AKTYWNE",        label: "Aktywne",        statuses: ["NOWE","W_ANALIZIE","BRAKUJE_INFO","GOTOWE_DO_WYCENY"] },
  { key: "WYCENA",         label: "Wycena",          statuses: ["WYCENA_PRZYGOTOWANA","WYCENA_WYSLANA","OCZEKUJE_NA_DECYZJE"] },
  { key: "ZAAKCEPTOWANE",  label: "Zaakceptowane",   statuses: ["ZAAKCEPTOWANE","ZAPLANOWANO_MONTAZ"] },
  { key: "ZAMKNIETE",      label: "Zamknięte",       statuses: ["ODRZUCONE","PRZEKSZTALCONE","ZAMKNIETE"] },
  { key: "ZARCHIWIZOWANE", label: "Zarchiwizowane",  statuses: null, filter: "ARCHIVED" },
  { key: "USUNIETE",       label: "Usunięte",        statuses: null, filter: "DELETED" },
  { key: "WSZYSTKIE",      label: "Wszystkie",       statuses: null, filter: "ALL" },
];

interface InquiryAnalysis {
  tags: string[];
  score: "LOW" | "MEDIUM" | "HIGH";
  suggestedOffer: string;
  warnings: string[];
}

interface InquiryRow {
  id: string;
  inquiryNumber: string;
  status: string;
  serviceType: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  investmentCity: string | null;
  aestheticsScale: number | null;
  priorities: string;
  expectedDate: string | null;
  formAnswers: string;
  tags: string;
  autoAnalysis: string;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { photos: number; quotes: number };
}

function safeJson<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InquiriesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("AKTYWNE");
  const [q, setQ] = useState("");

  // Odczyt ?tab= z URL po stronie klienta (bez useSearchParams — wymaga Suspense)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabKey | null;
    if (t && TABS.find((tb) => tb.key === t)) setTab(t);
  }, []);
  const [serviceType, setServiceType] = useState("__ALL__");
  const [page, setPage] = useState(1);

  const currentTab = TABS.find((t) => t.key === tab)!;

  const { data, isLoading } = useQuery({
    queryKey: ["inquiries", tab, q, serviceType, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentTab.filter) {
        params.set("filter", currentTab.filter);
      } else if (currentTab.statuses) {
        params.set("status", currentTab.statuses.join(","));
      }
      if (q) params.set("q", q);
      if (serviceType && serviceType !== "__ALL__") params.set("serviceType", serviceType);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await fetch(`/api/inquiries?${params}`);
      return res.json() as Promise<{ data: InquiryRow[]; total: number; page: number; limit: number }>;
    },
    refetchInterval: 30000,
  });

  const inquiries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Zapytania ofertowe</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total} {total === 1 ? "zapytanie" : total < 5 ? "zapytania" : "zapytań"}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-red-800 hover:bg-red-900 text-white"
            onClick={() => router.push("/inquiries/new")}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nowe zapytanie
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                tab === t.key ? "bg-red-800 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Link do formularza */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-100">
        <ClientFormLinkBanner />
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Szukaj po nazwisku, emailu, telefonie..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-8 h-9 text-sm"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={serviceType} onValueChange={(v) => { setServiceType(v); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Typ usługi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Wszystkie typy</SelectItem>
              {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Brak zapytań</p>
            <p className="text-sm text-gray-400 mt-1">
              {q || serviceType !== "__ALL__"
                ? "Zmień filtry lub wyczyść wyszukiwanie"
                : "Dodaj pierwsze zapytanie ofertowe"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {inquiries.map((inq) => (
              <InquiryCard key={inq.id} inquiry={inq} onClick={() => router.push(`/inquiries/${inq.id}`)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 pb-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Poprzednia
            </Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Następna
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ClientFormLinkBanner ──────────────────────────────────────────────────────

function ClientFormLinkBanner() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined"
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/quote/inquiry`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/quote/inquiry`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-blue-900">📋 Link do formularza dla klienta</span>
        <ChevronDown className={cn("w-4 h-4 text-blue-600 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-blue-100 pt-3 flex flex-col sm:flex-row gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&bgcolor=eff6ff&color=1e3a5f`}
            alt="QR kod"
            className="w-36 h-36 rounded-lg border border-blue-200 shrink-0 mx-auto sm:mx-0"
          />
          <div className="flex-1 space-y-2.5">
            <p className="text-xs text-blue-700">Wyślij ten link klientowi — może wypełnić formularz bez logowania:</p>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-700 truncate flex-1 font-mono">{url}</span>
              <button onClick={copy} className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-900">
                {copied ? "✓ Skopiowano" : "Kopiuj"}
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy} className="flex-1 border-blue-200 text-blue-800 hover:bg-blue-100">
                {copied ? <><Check className="w-3.5 h-3.5 mr-1.5" />Skopiowano!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Kopiuj link</>}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 border-blue-200 text-blue-800 hover:bg-blue-100" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Otwórz formularz
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── InquiryCard ───────────────────────────────────────────────────────────────

function InquiryCard({ inquiry, onClick }: { inquiry: InquiryRow; onClick: () => void }) {
  const analysis: InquiryAnalysis = safeJson(inquiry.autoAnalysis, { tags: [], score: "MEDIUM", suggestedOffer: "STANDARD", warnings: [] });
  const tags: string[] = safeJson(inquiry.tags, []);
  const formAnswers: Record<string, string> = safeJson(inquiry.formAnswers, {});

  // Skrót potrzeby z formAnswers
  const needDesc = formAnswers.description ?? formAnswers.problemDesc ?? formAnswers.notes ?? "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-white border rounded-xl p-4 hover:border-red-200 hover:shadow-sm transition-all",
        inquiry.deletedAt ? "border-red-200 opacity-70" : inquiry.archivedAt ? "border-gray-300 opacity-80" : "border-gray-200"
      )}
    >
      {/* Row 1: number + status + type + score */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="font-mono text-xs text-gray-400">{inquiry.inquiryNumber}</span>
        <Badge className={cn("text-xs px-2 py-0", STATUS_COLORS[inquiry.status] ?? "bg-gray-100 text-gray-600")}>
          {STATUS_LABELS[inquiry.status] ?? inquiry.status}
        </Badge>
        <Badge variant="outline" className="text-xs px-2 py-0">
          {SERVICE_TYPE_LABELS[inquiry.serviceType] ?? inquiry.serviceType}
        </Badge>
        {analysis.score === "HIGH" && (
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SCORE_BADGE.HIGH)}>Wysoki potencjał</span>
        )}
        {inquiry.deletedAt && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Usunięte</span>}
        {inquiry.archivedAt && !inquiry.deletedAt && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Zarchiwizowane</span>}
      </div>

      {/* Row 2: name + company */}
      <p className="font-medium text-gray-900 truncate">
        {inquiry.contactName}
        {inquiry.companyName && <span className="text-gray-500 font-normal"> — {inquiry.companyName}</span>}
      </p>

      {/* Row 3: contact + city */}
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
        {inquiry.contactPhone && (
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{inquiry.contactPhone}</span>
        )}
        {inquiry.contactEmail && (
          <span className="flex items-center gap-1 truncate max-w-40"><Mail className="w-3 h-3" />{inquiry.contactEmail}</span>
        )}
        {inquiry.investmentCity && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inquiry.investmentCity}</span>
        )}
        {inquiry.expectedDate && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{inquiry.expectedDate}</span>
        )}
      </div>

      {/* Row 4: description snippet */}
      {needDesc && (
        <p className="mt-1.5 text-xs text-gray-500 line-clamp-1 italic">
          {needDesc.substring(0, 120)}
        </p>
      )}

      {/* Row 5: tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600")}>
              {tag}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Row 6: meta right + counters */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          aktywność: {formatDistanceToNow(new Date(inquiry.updatedAt), { locale: pl, addSuffix: true })}
        </span>
        <div className="flex items-center gap-2">
          {inquiry._count.photos > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500">
              <Image className="w-3 h-3" />{inquiry._count.photos}
            </span>
          )}
          {inquiry._count.photos === 0 && (
            <span className="flex items-center gap-0.5 text-xs text-yellow-600">
              <AlertTriangle className="w-3 h-3" />brak zdjęć
            </span>
          )}
          {inquiry._count.quotes > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" />{inquiry._count.quotes}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {format(new Date(inquiry.createdAt), "d MMM yyyy", { locale: pl })}
          </span>
        </div>
      </div>
    </button>
  );
}
