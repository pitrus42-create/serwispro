"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Plus, Search, FileText, Phone, Mail, Image, CheckCircle2, Clock, X,
  ChevronDown, Copy, ExternalLink, Check, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NOWE: "Nowe",
  W_ANALIZIE: "W analizie",
  BRAKUJE_INFO: "Brakuje informacji",
  GOTOWE_DO_WYCENY: "Gotowe do wyceny",
  WYCENA_PRZYGOTOWANA: "Wycena przygotowana",
  WYCENA_WYSLANA: "Wycena wysłana",
  OCZEKUJE_NA_DECYZJE: "Oczekuje na decyzję",
  ZAAKCEPTOWANE: "Zaakceptowane",
  ODRZUCONE: "Odrzucone",
  PRZEKSZTALCONE: "Przekształcone",
  ZAPLANOWANO_MONTAZ: "Zaplanowano montaż",
  ZAMKNIETE: "Zamknięte",
};

const STATUS_COLORS: Record<string, string> = {
  NOWE: "bg-blue-100 text-blue-800",
  W_ANALIZIE: "bg-amber-100 text-amber-800",
  BRAKUJE_INFO: "bg-orange-100 text-orange-800",
  GOTOWE_DO_WYCENY: "bg-purple-100 text-purple-800",
  WYCENA_PRZYGOTOWANA: "bg-violet-100 text-violet-800",
  WYCENA_WYSLANA: "bg-indigo-100 text-indigo-800",
  OCZEKUJE_NA_DECYZJE: "bg-yellow-100 text-yellow-800",
  ZAAKCEPTOWANE: "bg-green-100 text-green-800",
  ODRZUCONE: "bg-red-100 text-red-800",
  PRZEKSZTALCONE: "bg-teal-100 text-teal-800",
  ZAPLANOWANO_MONTAZ: "bg-cyan-100 text-cyan-800",
  ZAMKNIETE: "bg-gray-100 text-gray-600",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV",
  ALARM: "Alarm",
  BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon/wideofon",
  SIEC: "Sieć LAN/Wi-Fi",
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

const TAB_STATUSES: Record<string, string[] | null> = {
  AKTYWNE: ["NOWE", "W_ANALIZIE", "BRAKUJE_INFO", "GOTOWE_DO_WYCENY"],
  WYCENA: ["WYCENA_PRZYGOTOWANA", "WYCENA_WYSLANA", "OCZEKUJE_NA_DECYZJE"],
  ZAAKCEPTOWANE: ["ZAAKCEPTOWANE", "ZAPLANOWANO_MONTAZ"],
  ZAMKNIETE: ["ODRZUCONE", "PRZEKSZTALCONE", "ZAMKNIETE"],
  WSZYSTKIE: null,
};

const ACTIVE_STATUSES = [
  "NOWE", "W_ANALIZIE", "BRAKUJE_INFO", "GOTOWE_DO_WYCENY",
  "WYCENA_PRZYGOTOWANA", "WYCENA_WYSLANA", "OCZEKUJE_NA_DECYZJE",
  "ZAAKCEPTOWANE", "ZAPLANOWANO_MONTAZ",
];

type TabKey = keyof typeof TAB_STATUSES;

interface InquiryRow {
  id: string;
  inquiryNumber: string;
  status: string;
  serviceType: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  createdAt: string;
  _count: { photos: number; quotes: number };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InquiriesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("AKTYWNE");
  const [q, setQ] = useState("");
  const [serviceType, setServiceType] = useState("__ALL__");
  const [page, setPage] = useState(1);

  const tabStatuses = TAB_STATUSES[tab];
  const statusParam = tabStatuses ? tabStatuses.join(",") : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["inquiries", tab, q, serviceType, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusParam) params.set("status", statusParam);
      if (q) params.set("q", q);
      if (serviceType && serviceType !== "__ALL__") params.set("serviceType", serviceType);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await fetch(`/api/inquiries?${params}`);
      return res.json() as Promise<{ data: InquiryRow[]; total: number; page: number; limit: number }>;
    },
    refetchInterval: 30000,
  });

  // Licznik aktywnych zapytań — niezależny od zakładki
  const { data: activeCount } = useQuery({
    queryKey: ["inquiries-active-count"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", ACTIVE_STATUSES.join(","));
      params.set("limit", "1");
      params.set("page", "1");
      const res = await fetch(`/api/inquiries?${params}`);
      const json = await res.json() as { total: number };
      return json.total;
    },
    refetchInterval: 30000,
  });

  const inquiries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const active = activeCount ?? 0;

  const deleteInquiry = async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Zapytanie zostało usunięte");
      qc.invalidateQueries({ queryKey: ["inquiries"] });
      qc.invalidateQueries({ queryKey: ["inquiries-active-count"] });
      qc.invalidateQueries({ queryKey: ["inquiries-count"] });
    } catch {
      toast.error("Nie udało się usunąć zapytania");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Zapytania ofertowe</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {active} aktywnych {active === 1 ? "zapytanie" : active < 5 ? "zapytania" : "zapytań"}
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
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(Object.keys(TAB_STATUSES) as TabKey[]).map((key) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                tab === key
                  ? "bg-red-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {key === "AKTYWNE" ? "Aktywne" :
               key === "WYCENA" ? "Wycena" :
               key === "ZAAKCEPTOWANE" ? "Zaakceptowane" :
               key === "ZAMKNIETE" ? "Zamknięte" : "Wszystkie"}
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
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
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
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
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
              <InquiryCard
                key={inq.id}
                inquiry={inq}
                onClick={() => router.push(`/inquiries/${inq.id}`)}
                onDelete={() => deleteInquiry(inq.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 pb-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Poprzednia
            </Button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
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
        <span className="text-sm font-medium text-blue-900">
          📋 Link do formularza dla klienta
        </span>
        <ChevronDown className={cn("w-4 h-4 text-blue-600 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-blue-100 pt-3 flex flex-col sm:flex-row gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&bgcolor=eff6ff&color=1e3a5f`}
            alt="QR kod formularza"
            className="w-36 h-36 rounded-lg border border-blue-200 shrink-0 mx-auto sm:mx-0"
          />
          <div className="flex-1 space-y-2.5">
            <p className="text-xs text-blue-700">
              Wyślij ten link klientowi — może wypełnić formularz zapytania bez logowania:
            </p>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-700 truncate flex-1 font-mono">{url}</span>
              <button
                onClick={copy}
                className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
              >
                {copied ? "✓ Skopiowano" : "Kopiuj"}
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy} className="flex-1 border-blue-200 text-blue-800 hover:bg-blue-100">
                {copied
                  ? <><Check className="w-3.5 h-3.5 mr-1.5" />Skopiowano!</>
                  : <><Copy className="w-3.5 h-3.5 mr-1.5" />Kopiuj link</>
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-blue-200 text-blue-800 hover:bg-blue-100"
                onClick={() => window.open(url, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Otwórz formularz
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── InquiryCard ───────────────────────────────────────────────────────────────

function InquiryCard({
  inquiry,
  onClick,
  onDelete,
}: {
  inquiry: InquiryRow;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="relative group">
        <button
          onClick={onClick}
          className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-red-200 hover:shadow-sm transition-all pr-12"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-gray-400">{inquiry.inquiryNumber}</span>
                <Badge className={cn("text-xs px-2 py-0", STATUS_COLORS[inquiry.status] ?? "bg-gray-100 text-gray-600")}>
                  {STATUS_LABELS[inquiry.status] ?? inquiry.status}
                </Badge>
                <Badge variant="outline" className="text-xs px-2 py-0">
                  {SERVICE_TYPE_LABELS[inquiry.serviceType] ?? inquiry.serviceType}
                </Badge>
              </div>

              <p className="font-medium text-gray-900 truncate">
                {inquiry.contactName}
                {inquiry.companyName && (
                  <span className="text-gray-500 font-normal"> — {inquiry.companyName}</span>
                )}
              </p>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {inquiry.contactPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {inquiry.contactPhone}
                  </span>
                )}
                {inquiry.contactEmail && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" />
                    {inquiry.contactEmail}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(inquiry.createdAt), "d MMM yyyy", { locale: pl })}
              </span>
              <div className="flex items-center gap-2">
                {inquiry._count.photos > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-500">
                    <Image className="w-3 h-3" />
                    {inquiry._count.photos}
                  </span>
                )}
                {inquiry._count.quotes > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {inquiry._count.quotes}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Przycisk usuwania — widoczny po najechaniu */}
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50"
          title="Usuń zapytanie"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Usuń zapytanie</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Czy na pewno chcesz usunąć zapytanie <strong>{inquiry.inquiryNumber}</strong> od <strong>{inquiry.contactName}</strong>?
            Tej operacji nie można cofnąć.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Anuluj
            </Button>
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white"
              onClick={() => { setConfirmOpen(false); onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
