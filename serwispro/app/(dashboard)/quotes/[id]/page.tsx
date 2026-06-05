"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, Check, Star, ChevronDown,
  ChevronUp, Receipt, FileText, ExternalLink, Mail, CheckCircle2, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ROBOCZA: "Robocza",
  GOTOWA: "Gotowa",
  WYSLANA: "Wysłana",
  ZAAKCEPTOWANA_TEL: "Zaakceptowana (tel.)",
  ZAAKCEPTOWANA_MAIL: "Zaakceptowana (email)",
  ODRZUCONA: "Odrzucona",
  WYGASLA: "Wygasła",
};

const STATUS_COLORS: Record<string, string> = {
  ROBOCZA: "bg-gray-100 text-gray-700",
  GOTOWA: "bg-blue-100 text-blue-800",
  WYSLANA: "bg-indigo-100 text-indigo-800",
  ZAAKCEPTOWANA_TEL: "bg-green-100 text-green-800",
  ZAAKCEPTOWANA_MAIL: "bg-green-100 text-green-800",
  ODRZUCONA: "bg-red-100 text-red-800",
  WYGASLA: "bg-gray-100 text-gray-500",
};

const ITEM_TYPES = [
  { value: "SPRZET",        label: "Sprzęt" },
  { value: "ROBOCIZNA",     label: "Robocizna" },
  { value: "KONFIGURACJA",  label: "Konfiguracja" },
  { value: "MATERIALY",     label: "Materiały" },
  { value: "INNE",          label: "Inne" },
];

const VAT_RATES = [0, 8, 23];

const PACKAGE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  MINIMUM: { bg: "bg-gray-50",   border: "border-gray-200",  badge: "bg-gray-100 text-gray-700" },
  STANDARD:{ bg: "bg-blue-50",   border: "border-blue-200",  badge: "bg-blue-100 text-blue-800" },
  PRO:     { bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-800" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  itemType: string;
  quantity: number;
  unit: string;
  netPrice: number;
  vatRate: number;
  grossPrice: number;
  isVisibleToClient: boolean;
  modelName: string | null;
  photoUrl: string | null;
}

interface BenefitsData { title: string; points: string[] }
interface BenefitsTemplateRecord { id: string; name: string; title: string; points: string; }

const DEFAULT_BENEFITS: Record<string, BenefitsData> = {
  MINIMUM: {
    title: "Ekonomiczne rozwiązanie spełniające podstawowe założenia systemu.",
    points: [
      "Spełnia podstawowe założenia systemu zabezpieczeń.",
      "Zapewnia realne poczucie bezpieczeństwa przy ograniczonym budżecie.",
      "Obejmuje niezbędne elementy do prawidłowego działania systemu.",
      "Jest dobrym wyborem, gdy najważniejsze jest uruchomienie systemu w możliwie ekonomicznej wersji.",
      "Pozwala w przyszłości rozbudować instalację, jeżeli warunki techniczne na to pozwolą.",
    ],
  },
  STANDARD: {
    title: "Rekomendowany wariant — najlepszy balans ceny, jakości i niezawodności.",
    points: [
      "Oparty na sprzęcie o bardzo dobrym stosunku jakości do ceny.",
      "Zapewnia stabilną i bezawaryjną pracę systemu w codziennym użytkowaniu.",
      "Obejmuje pełniejszą konfigurację i lepsze dopasowanie do potrzeb klienta.",
      "Daje większy komfort użytkowania niż wariant podstawowy.",
      "Jest rekomendowany jako najbardziej opłacalny wybór dla większości realizacji.",
      "Pozwala uzyskać profesjonalny efekt bez wchodzenia w najwyższy budżet.",
    ],
  },
  PRO: {
    title: "Rozwiązanie premium dla klientów oczekujących najwyższej jakości i indywidualnego podejścia.",
    points: [
      "Profesjonalny sprzęt dobrany pod wyższe wymagania użytkownika.",
      "Konfiguracja systemu dostosowana do indywidualnych potrzeb klienta.",
      "Instalacja wykonana z dużą dbałością o estetykę i najmniejsze szczegóły.",
      "Większa możliwość rozbudowy systemu w przyszłości.",
      "Dodatkowe konsultacje przy konfiguracji i użytkowaniu systemu.",
      "Priorytetowe podejście do realizacji i ustalenia terminu montażu.",
      "Roczna karta SIM do komunikacji systemu w cenie pakietu, jeżeli dana konfiguracja wymaga łączności GSM/LTE.",
      "Najlepszy wybór dla osób, które oczekują maksymalnej niezawodności, wygody i profesjonalnego efektu końcowego.",
    ],
  },
};

function parseBenefits(raw: string | null | undefined, packageType: string): BenefitsData {
  if (raw) { try { return JSON.parse(raw) as BenefitsData; } catch { /* fall through */ } }
  return DEFAULT_BENEFITS[packageType] ?? DEFAULT_BENEFITS.MINIMUM;
}

interface QuotePackage {
  id: string;
  packageType: string;
  name: string;
  description: string | null;
  isRecommended: boolean;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  discount: number | null;
  includes: string | null;
  excludes: string | null;
  benefits: string | null;
  items: QuoteItem[];
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  quoteType: string;
  validUntil: string | null;
  internalNotes: string | null;
  summary: string | null;
  conditions: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientCompany: string | null;
  clientNip: string | null;
  investmentAddress: string | null;
  serviceType: string | null;
  createdAt: string;
  packages: QuotePackage[];
  acceptance: { acceptedPackage: string; acceptanceType: string; note: string | null } | null;
  inquiry: {
    id: string;
    inquiryNumber: string;
    serviceType: string;
    contactName: string;
    aestheticsScale: number | null;
    priorities: string;
    expectedDate: string | null;
  } | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function QuoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [acceptDialog, setAcceptDialog] = useState(false);
  const [createOrderDialog, setCreateOrderDialog] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error();
      return res.json() as Promise<Quote>;
    },
  });

  const updateQuote = useMutation({
    mutationFn: async (data: Partial<Quote>) => {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote", id] }),
    onError: () => toast.error("Błąd zapisywania"),
  });

  const markSent = async () => {
    await fetch(`/api/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WYSLANA" }),
    });
    qc.invalidateQueries({ queryKey: ["quote", id] });
    toast.success("Wycena oznaczona jako wysłana");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg w-64 animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Wycena nie została znaleziona</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Wróć
        </Button>
      </div>
    );
  }

  const isAccepted = quote.status.startsWith("ZAAKCEPTOWANA");
  const qt = quote.quoteType ?? "three_packages";
  const pkgOrder =
    qt === "two_packages"   ? ["MINIMUM", "PRO"] :
    qt === "single_variant" ? ["STANDARD"] :
    ["MINIMUM", "STANDARD", "PRO"];
  const packagesOrdered = pkgOrder
    .map((t) => quote.packages.find((p) => p.packageType === t))
    .filter(Boolean) as QuotePackage[];
  // single_variant: jeśli nie ma pakietu o typie STANDARD, weź pierwszy dostępny
  const finalPackages = (qt === "single_variant" && packagesOrdered.length === 0)
    ? quote.packages.slice(0, 1)
    : packagesOrdered;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-gray-900">{quote.quoteNumber}</span>
                <Badge className={cn("text-xs", STATUS_COLORS[quote.status] ?? "bg-gray-100")}>
                  {STATUS_LABELS[quote.status] ?? quote.status}
                </Badge>
                {quote.inquiry && (
                  <button
                    onClick={() => router.push(`/inquiries/${quote.inquiry!.id}`)}
                    className="text-xs text-red-800 hover:underline"
                  >
                    ← {quote.inquiry.inquiryNumber}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {quote.clientName}
                {quote.clientCompany ? ` — ${quote.clientCompany}` : ""}
              </p>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/quotes/${id}/pdf`, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              PDF
            </Button>

            {/* Oznacz jako wysłaną */}
            {!["WYSLANA","ZAAKCEPTOWANA_TEL","ZAAKCEPTOWANA_MAIL","ODRZUCONA"].includes(quote.status) && (
              <Button variant="outline" size="sm" onClick={markSent}>
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Oznacz wysłaną
              </Button>
            )}

            {/* Utwórz zlecenie */}
            {isAccepted && (
              <Button
                size="sm"
                className="bg-red-800 hover:bg-red-900 text-white"
                onClick={() => setCreateOrderDialog(true)}
              >
                <Wrench className="w-3.5 h-3.5 mr-1.5" />
                Utwórz zlecenie
              </Button>
            )}

            {/* Zapisz akceptację */}
            {!isAccepted && (
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={() => setAcceptDialog(true)}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Zapisz akceptację
              </Button>
            )}

            {/* Status */}
            <Select
              value={quote.status}
              onValueChange={(v) => updateQuote.mutate({ status: v })}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Accepted banner */}
        {isAccepted && quote.acceptance && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Zaakceptowano pakiet <strong>{quote.acceptance.acceptedPackage}</strong>
              {" · "}{STATUS_LABELS[quote.status]}
              {quote.acceptance.note ? ` · ${quote.acceptance.note}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-5 space-y-5 max-w-5xl">
          <GeneralSection quote={quote} onSave={(data) => updateQuote.mutate(data)} />
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              {qt === "single_variant" ? "Wariant wyceny" : "Pakiety wyceny"}
            </h2>
            <div className={cn(
              "grid gap-4 grid-cols-1",
              qt === "three_packages" && "lg:grid-cols-3",
              qt === "two_packages"   && "lg:grid-cols-2",
              qt === "single_variant" && "max-w-xl",
            )}>
              {finalPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  quoteId={id}
                  onUpdate={() => qc.invalidateQueries({ queryKey: ["quote", id] })}
                />
              ))}
            </div>
          </div>
          <InternalNotesSection quote={quote} onSave={(data) => updateQuote.mutate(data)} />
        </div>
      </div>

      {/* Create order dialog */}
      <CreateOrderDialog
        open={createOrderDialog}
        onClose={() => setCreateOrderDialog(false)}
        quoteId={id}
        defaultOrderType={quote.inquiry?.serviceType
          ? ({ CCTV:"MONTAZ", ALARM:"MONTAZ", BRAMA:"MONTAZ", DOMOFON:"MONTAZ",
                SIEC:"MONTAZ", AWARIA:"AWARIA", KONSERWACJA:"KONSERWACJA",
                MODERNIZACJA:"MODERNIZACJA" } as Record<string,string>)[quote.inquiry.serviceType] ?? "MONTAZ"
          : "MONTAZ"}
      />

      {/* Acceptance dialog */}
      <AcceptanceDialog
        open={acceptDialog}
        onClose={() => setAcceptDialog(false)}
        packages={finalPackages}
        quoteId={id}
        onAccepted={() => {
          setAcceptDialog(false);
          qc.invalidateQueries({ queryKey: ["quote", id] });
          toast.success("Akceptacja zapisana");
        }}
      />
    </div>
  );
}

// ── Acceptance Dialog ─────────────────────────────────────────────────────────

function AcceptanceDialog({
  open, onClose, packages, quoteId, onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  packages: QuotePackage[];
  quoteId: string;
  onAccepted: () => void;
}) {
  const [form, setForm] = useState({
    acceptedPackage: "STANDARD",
    acceptanceType: "TELEFON",
    note: "",
    acceptedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [saving, setSaving] = useState(false);

  const ACCEPTANCE_TYPES = [
    { value: "TELEFON",   label: "Telefonicznie" },
    { value: "EMAIL",     label: "Emailem" },
    { value: "OSOBISCIE", label: "Osobiście" },
    { value: "INNE",      label: "Inny sposób" },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      onAccepted();
    } catch {
      toast.error("Nie udało się zapisać akceptacji");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Zapisz akceptację wyceny</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Zaakceptowany pakiet</Label>
            <Select value={form.acceptedPackage} onValueChange={(v) => setForm(p => ({...p, acceptedPackage: v}))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {packages.map(pkg => (
                  <SelectItem key={pkg.packageType} value={pkg.packageType}>
                    {pkg.name} ({pkg.packageType})
                    {pkg.isRecommended ? " ★" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sposób akceptacji</Label>
            <Select value={form.acceptanceType} onValueChange={(v) => setForm(p => ({...p, acceptanceType: v}))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCEPTANCE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data akceptacji</Label>
            <Input
              type="datetime-local"
              value={form.acceptedAt}
              onChange={(e) => setForm(p => ({...p, acceptedAt: e.target.value}))}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notatka (opcjonalnie)</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm(p => ({...p, note: e.target.value}))}
              rows={2}
              className="text-sm"
              placeholder="np. Klient potwierdził w rozmowie telefonicznej o 14:30"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Anuluj</Button>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={save}
            disabled={saving}
          >
            <Check className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Zapisywanie..." : "Zapisz akceptację"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── General Section ───────────────────────────────────────────────────────────

function GeneralSection({ quote, onSave }: { quote: Quote; onSave: (d: Partial<Quote>) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    clientName: quote.clientName ?? "",
    clientPhone: quote.clientPhone ?? "",
    clientEmail: quote.clientEmail ?? "",
    clientCompany: quote.clientCompany ?? "",
    clientNip: quote.clientNip ?? "",
    investmentAddress: quote.investmentAddress ?? "",
    summary: quote.summary ?? "",
    conditions: quote.conditions ?? "",
    validUntil: quote.validUntil ? format(new Date(quote.validUntil), "yyyy-MM-dd") : "",
  });

  const save = () => {
    onSave({
      ...form,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
    });
    setEditing(false);
    toast.success("Zapisano");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-medium text-gray-900 text-sm">Dane wyceny i klienta</h2>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edytuj
          </Button>
        )}
      </div>

      <div className="p-4">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Klient" value={form.clientName} onChange={(v) => setForm(p => ({...p, clientName: v}))} />
              <Field label="Telefon" value={form.clientPhone} onChange={(v) => setForm(p => ({...p, clientPhone: v}))} />
              <Field label="Email" value={form.clientEmail} onChange={(v) => setForm(p => ({...p, clientEmail: v}))} />
              <Field label="Firma" value={form.clientCompany} onChange={(v) => setForm(p => ({...p, clientCompany: v}))} />
              <Field label="NIP" value={form.clientNip} onChange={(v) => setForm(p => ({...p, clientNip: v}))} />
              <Field label="Adres inwestycji" value={form.investmentAddress} onChange={(v) => setForm(p => ({...p, investmentAddress: v}))} />
              <div className="space-y-1">
                <Label className="text-xs">Ważna do</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm(p => ({...p, validUntil: e.target.value}))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Podsumowanie potrzeb (widoczne dla klienta)</Label>
              <Textarea value={form.summary} onChange={(e) => setForm(p => ({...p, summary: e.target.value}))} rows={2} className="text-sm" placeholder="Krótki opis potrzeb klienta i zakresu prac..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Warunki realizacji (widoczne dla klienta)</Label>
              <Textarea value={form.conditions} onChange={(e) => setForm(p => ({...p, conditions: e.target.value}))} rows={2} className="text-sm" placeholder="Terminy płatności, gwarancja, zasady realizacji..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} className="bg-red-800 hover:bg-red-900 text-white">
                <Save className="w-3 h-3 mr-1" /> Zapisz
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Anuluj</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <InfoCell label="Klient" value={quote.clientName} />
            <InfoCell label="Telefon" value={quote.clientPhone} />
            <InfoCell label="Email" value={quote.clientEmail} />
            {quote.clientCompany && <InfoCell label="Firma" value={quote.clientCompany} />}
            {quote.clientNip && <InfoCell label="NIP" value={quote.clientNip} />}
            {quote.investmentAddress && <InfoCell label="Adres" value={quote.investmentAddress} />}
            {quote.validUntil && (
              <InfoCell label="Ważna do" value={format(new Date(quote.validUntil), "d MMMM yyyy", { locale: pl })} />
            )}
            {quote.summary && (
              <div className="col-span-full mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Podsumowanie</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.summary}</p>
              </div>
            )}
            {quote.conditions && (
              <div className="col-span-full mt-1">
                <p className="text-xs text-gray-500 mb-1">Warunki realizacji</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.conditions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg, quoteId, onUpdate,
}: {
  pkg: QuotePackage;
  quoteId: string;
  onUpdate: () => void;
}) {
  const [addingItem, setAddingItem] = useState(false);
  const [editingPkg, setEditingPkg] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const colors = PACKAGE_COLORS[pkg.packageType] ?? PACKAGE_COLORS.MINIMUM;

  const savePackage = async (data: Partial<QuotePackage>) => {
    await fetch(`/api/quotes/${quoteId}/packages/${pkg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
    setEditingPkg(false);
  };

  const toggleRecommended = async () => {
    await fetch(`/api/quotes/${quoteId}/packages/${pkg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRecommended: !pkg.isRecommended }),
    });
    onUpdate();
  };

  const totalNet = pkg.items.reduce((s, i) => s + i.netPrice * i.quantity, 0);
  const totalGross = pkg.items.reduce((s, i) => s + i.grossPrice * i.quantity, 0);

  return (
    <div className={cn("rounded-xl border-2 overflow-hidden", colors.border)}>
      {/* Package header */}
      <div className={cn("px-4 py-3", colors.bg)}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs font-medium", colors.badge)}>
              {pkg.packageType}
            </Badge>
            {pkg.isRecommended && (
              <Badge className="text-xs bg-amber-100 text-amber-800 flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> Rekomendowany
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={toggleRecommended}
              title={pkg.isRecommended ? "Usuń rekomendację" : "Oznacz jako rekomendowany"}
              className="text-gray-400 hover:text-amber-600 p-1"
            >
              <Star className={cn("w-3.5 h-3.5", pkg.isRecommended ? "fill-amber-500 text-amber-500" : "")} />
            </button>
            <button onClick={() => setEditingPkg(!editingPkg)} className="text-gray-400 hover:text-gray-700 p-1">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-700 p-1">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="font-semibold text-gray-900 text-sm">{pkg.name}</p>
        {pkg.description && <p className="text-xs text-gray-600 mt-0.5">{pkg.description}</p>}
      </div>

      {/* Edit package */}
      {editingPkg && (
        <PackageEditForm pkg={pkg} onSave={savePackage} onCancel={() => setEditingPkg(false)} />
      )}

      {/* Items */}
      {expanded && (
        <div className="p-3 space-y-2">
          {pkg.items.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Brak pozycji — dodaj poniżej</p>
          )}
          {pkg.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              quoteId={quoteId}
              pkgId={pkg.id}
              onUpdate={onUpdate}
            />
          ))}

          {addingItem ? (
            <AddItemForm
              pkgId={pkg.id}
              quoteId={quoteId}
              onDone={() => { setAddingItem(false); onUpdate(); }}
              onCancel={() => setAddingItem(false)}
            />
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-800 py-1.5 border border-dashed border-gray-200 hover:border-red-300 rounded-lg transition-colors px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Dodaj pozycję
            </button>
          )}

          {/* Totals */}
          {pkg.items.length > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Netto</span>
                <span>{totalNet.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Brutto</span>
                <span>{totalGross.toFixed(2)} zł</span>
              </div>
              {pkg.discount && (
                <div className="flex justify-between text-xs text-green-700">
                  <span>Rabat</span>
                  <span>-{pkg.discount}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Benefits section */}
      {expanded && <PackageBenefitsView benefits={pkg.benefits} packageType={pkg.packageType} />}
    </div>
  );
}

function PackageBenefitsView({ benefits, packageType }: { benefits: string | null; packageType: string }) {
  const data = parseBenefits(benefits, packageType);
  return (
    <div className="border-t border-gray-100 px-3 py-3 bg-white">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Korzyści pakietu</p>
      <p className="text-xs font-semibold text-gray-700 mb-2 leading-snug">{data.title}</p>
      <ul className="space-y-1">
        {data.points.map((point, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
            <Check className="w-3 h-3 text-green-600 mt-0.5 shrink-0" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Package Edit Form ─────────────────────────────────────────────────────────

function PackageEditForm({
  pkg, onSave, onCancel,
}: {
  pkg: QuotePackage;
  onSave: (d: Partial<QuotePackage>) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const defaultBenefits = parseBenefits(pkg.benefits, pkg.packageType);
  const [form, setForm] = useState({
    name: pkg.name,
    description: pkg.description ?? "",
    includes: pkg.includes ?? "",
    excludes: pkg.excludes ?? "",
    discount: pkg.discount !== null ? String(pkg.discount) : "",
    benefitsTitle: defaultBenefits.title,
    benefitsPoints: defaultBenefits.points as string[],
  });
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const { data: savedTemplates = [] } = useQuery<BenefitsTemplateRecord[]>({
    queryKey: ["benefits-templates"],
    queryFn: async () => {
      const r = await fetch("/api/benefits-templates");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const resetBenefits = () => {
    const def = DEFAULT_BENEFITS[pkg.packageType] ?? DEFAULT_BENEFITS.MINIMUM;
    setForm(p => ({ ...p, benefitsTitle: def.title, benefitsPoints: [...def.points] }));
  };

  const applyTemplate = (title: string, pointsRaw: string | string[]) => {
    const pts: string[] = Array.isArray(pointsRaw) ? pointsRaw : JSON.parse(pointsRaw);
    setForm(p => ({ ...p, benefitsTitle: title, benefitsPoints: pts }));
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/benefits-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          title: form.benefitsTitle,
          points: form.benefitsPoints.filter(s => s.trim()),
        }),
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["benefits-templates"] });
      toast.success("Szablon zapisany");
      setTemplateName("");
      setShowSaveTemplate(false);
    } catch {
      toast.error("Nie udało się zapisać szablonu");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSave = () => {
    const benefits = JSON.stringify({
      title: form.benefitsTitle,
      points: form.benefitsPoints.filter(s => s.trim()),
    });
    onSave({ ...form, discount: form.discount ? parseFloat(form.discount) : null, benefits });
  };

  return (
    <div className="px-3 pb-3 space-y-2 border-b border-gray-100 bg-white">
      <div className="space-y-1">
        <Label className="text-xs">Nazwa pakietu</Label>
        <Input value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} className="h-7 text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Opis</Label>
        <Textarea value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} rows={2} className="text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Co jest wliczone</Label>
          <Textarea value={form.includes} onChange={(e) => setForm(p => ({...p, includes: e.target.value}))} rows={2} className="text-xs" placeholder="Montaż, konfiguracja..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Co NIE jest wliczone</Label>
          <Textarea value={form.excludes} onChange={(e) => setForm(p => ({...p, excludes: e.target.value}))} rows={2} className="text-xs" placeholder="Okablowanie dodatkowe..." />
        </div>
      </div>
      <div className="space-y-1 w-24">
        <Label className="text-xs">Rabat (%)</Label>
        <Input type="number" value={form.discount} onChange={(e) => setForm(p => ({...p, discount: e.target.value}))} className="h-7 text-xs" min="0" max="100" placeholder="0" />
      </div>

      {/* Korzyści */}
      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <Label className="text-xs font-semibold text-gray-600">Korzyści pakietu</Label>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-800">
                  Wstaw z szablonu <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-[10px] text-gray-500">Domyślne</DropdownMenuLabel>
                {Object.entries(DEFAULT_BENEFITS).map(([key, def]) => (
                  <DropdownMenuItem key={key} className="text-xs cursor-pointer" onClick={() => applyTemplate(def.title, def.points)}>
                    {key.charAt(0) + key.slice(1).toLowerCase()}
                  </DropdownMenuItem>
                ))}
                {savedTemplates.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-gray-500">Zapisane szablony</DropdownMenuLabel>
                    {savedTemplates.map((t) => (
                      <DropdownMenuItem key={t.id} className="text-xs cursor-pointer" onClick={() => applyTemplate(t.title, t.points)}>
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setShowSaveTemplate(p => !p)} className="text-[10px] text-gray-500 hover:text-gray-700">
              Zapisz jako szablon
            </button>
            <button onClick={resetBenefits} className="text-[10px] text-blue-600 hover:text-blue-800">
              Przywróć domyślne
            </button>
          </div>
        </div>

        {showSaveTemplate && (
          <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded border border-gray-200">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nazwa szablonu..."
              className="h-6 text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); }}
            />
            <Button
              size="sm"
              className="h-6 text-xs px-2 bg-red-800 hover:bg-red-900 text-white"
              onClick={saveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
            >
              {savingTemplate ? "..." : "Zapisz"}
            </Button>
            <button onClick={() => setShowSaveTemplate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Tytuł sekcji</Label>
          <Input value={form.benefitsTitle} onChange={(e) => setForm(p => ({...p, benefitsTitle: e.target.value}))} className="h-7 text-xs" placeholder="Opis korzyści pakietu..." />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Punkty</Label>
          <div className="space-y-1">
            {form.benefitsPoints.map((point, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                <Input
                  value={point}
                  onChange={(e) => {
                    const pts = [...form.benefitsPoints];
                    pts[idx] = e.target.value;
                    setForm(p => ({ ...p, benefitsPoints: pts }));
                  }}
                  className="h-7 text-xs flex-1"
                  placeholder="Punkt korzyści..."
                />
                <button
                  onClick={() => setForm(p => ({ ...p, benefitsPoints: p.benefitsPoints.filter((_, i) => i !== idx) }))}
                  className="text-gray-300 hover:text-red-500 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setForm(p => ({ ...p, benefitsPoints: [...p.benefitsPoints, ""] }))}
            className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 mt-1"
          >
            <Plus className="w-2.5 h-2.5" /> Dodaj punkt
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-6 text-xs bg-red-800 hover:bg-red-900 text-white px-2" onClick={handleSave}>
          <Save className="w-3 h-3 mr-1" />Zapisz
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item, quoteId, pkgId, onUpdate,
}: {
  item: QuoteItem;
  quoteId: string;
  pkgId: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const typeLabel = ITEM_TYPES.find(t => t.value === item.itemType)?.label ?? item.itemType;

  const deleteItem = async () => {
    await fetch(`/api/quotes/${quoteId}/packages/${pkgId}/items/${item.id}`, { method: "DELETE" });
    onUpdate();
  };

  if (editing) {
    return (
      <EditItemForm
        item={item}
        quoteId={quoteId}
        pkgId={pkgId}
        onDone={() => { setEditing(false); onUpdate(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const lineGross = item.grossPrice * item.quantity;

  return (
    <div className="flex items-start gap-2 group">
      {/* Miniatura produktu */}
      {item.photoUrl && (
        <img
          src={item.photoUrl}
          alt=""
          className="w-10 h-10 rounded-md object-cover border border-gray-200 shrink-0 mt-0.5"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{item.name}</span>
          {item.modelName && (
            <span className="text-xs text-gray-400 italic">{item.modelName}</span>
          )}
          {!item.isVisibleToClient && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1 rounded">ukryte</span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{typeLabel}</span>
          <span>{item.quantity} {item.unit} × {item.netPrice.toFixed(2)} zł netto</span>
          <span className="text-gray-600 font-medium">{lineGross.toFixed(2)} zł</span>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700 p-0.5">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={deleteItem} className="text-gray-400 hover:text-red-600 p-0.5">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Add/Edit Item Form ────────────────────────────────────────────────────────

interface ItemFormData {
  name: string;
  description: string;
  itemType: string;
  quantity: string;
  unit: string;
  netPrice: string;
  vatRate: string;
  isVisibleToClient: boolean;
  modelName: string;
  photoUrl: string;
}

const emptyItemForm: ItemFormData = {
  name: "", description: "", itemType: "SPRZET", quantity: "1", unit: "szt",
  netPrice: "0", vatRate: "23", isVisibleToClient: true, modelName: "", photoUrl: "",
};

function AddItemForm({
  pkgId, quoteId, onDone, onCancel,
}: {
  pkgId: string;
  quoteId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ItemFormData>(emptyItemForm);
  const [saving, setSaving] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["catalog-search", catalogQ],
    queryFn: async () => {
      if (!catalogQ) return [];
      const res = await fetch(`/api/product-catalog?q=${encodeURIComponent(catalogQ)}`);
      return res.json() as Promise<{ id: string; name: string; modelName: string | null; itemType: string; unit: string; defaultNetPrice: number; vatRate: number; photoUrl?: string | null; showPhotoInQuote?: boolean }[]>;
    },
    enabled: catalogQ.length > 1,
  });

  const pickFromCatalog = (item: typeof catalogItems[0]) => {
    setForm({
      name: item.name,
      description: "",
      itemType: item.itemType,
      quantity: "1",
      unit: item.unit,
      netPrice: String(item.defaultNetPrice),
      vatRate: String(item.vatRate),
      isVisibleToClient: true,
      modelName: item.modelName ?? "",
      photoUrl: (item.showPhotoInQuote !== false && item.photoUrl) ? item.photoUrl : "",
    });
    setShowCatalog(false);
    setCatalogQ("");
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await fetch(`/api/quotes/${quoteId}/packages/${pkgId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-2">
      {/* Catalog search */}
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Szukaj w katalogu produktów..."
          value={catalogQ}
          onChange={(e) => { setCatalogQ(e.target.value); setShowCatalog(true); }}
          onFocus={() => setShowCatalog(true)}
          className="w-full h-7 text-xs border border-gray-200 rounded-md px-2 bg-blue-50"
        />
        {showCatalog && catalogItems.length > 0 && (
          <div className="absolute top-8 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
            {catalogItems.map(item => (
              <button key={item.id} onClick={() => pickFromCatalog(item)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0">
                <span className="font-medium">{item.name}</span>
                {item.modelName && <span className="text-gray-400 ml-1">({item.modelName})</span>}
                <span className="text-gray-400 ml-2">{item.defaultNetPrice.toFixed(2)} zł netto</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ItemFormFields form={form} setForm={setForm} onSave={save} onCancel={onCancel} saving={saving} />
    </div>
  );
}

function EditItemForm({
  item, quoteId, pkgId, onDone, onCancel,
}: {
  item: QuoteItem;
  quoteId: string;
  pkgId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ItemFormData>({
    name: item.name,
    description: item.description ?? "",
    itemType: item.itemType,
    quantity: String(item.quantity),
    unit: item.unit,
    netPrice: String(item.netPrice),
    vatRate: String(item.vatRate),
    isVisibleToClient: item.isVisibleToClient,
    modelName: item.modelName ?? "",
    photoUrl: item.photoUrl ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/quotes/${quoteId}/packages/${pkgId}/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onDone();
  };

  return <ItemFormFields form={form} setForm={setForm} onSave={save} onCancel={onCancel} saving={saving} />;
}

function ItemFormFields({
  form, setForm, onSave, onCancel, saving,
}: {
  form: ItemFormData;
  setForm: (f: ItemFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const grossPreview = (parseFloat(form.netPrice) || 0) * (1 + (parseFloat(form.vatRate) || 0) / 100) * (parseFloat(form.quantity) || 0);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nazwa *</Label>
          <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-7 text-xs" placeholder="np. Kamera IP zewnętrzna 4Mpx" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Model / symbol (opcjonalnie)</Label>
          <Input value={form.modelName} onChange={(e) => setForm({...form, modelName: e.target.value})} className="h-7 text-xs" placeholder="np. Dahua IPC-HDW2849H" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Typ</Label>
          <select
            value={form.itemType}
            onChange={(e) => setForm({...form, itemType: e.target.value})}
            className="w-full h-7 text-xs border border-gray-200 rounded-md px-2 bg-white"
          >
            {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">VAT</Label>
          <select
            value={form.vatRate}
            onChange={(e) => setForm({...form, vatRate: e.target.value})}
            className="w-full h-7 text-xs border border-gray-200 rounded-md px-2 bg-white"
          >
            {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cena netto (zł)</Label>
          <Input type="number" min="0" step="0.01" value={form.netPrice} onChange={(e) => setForm({...form, netPrice: e.target.value})} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ilość / jedn.</Label>
          <div className="flex gap-1">
            <Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} className="h-7 text-xs w-16" />
            <Input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} className="h-7 text-xs" placeholder="szt" />
          </div>
        </div>
      </div>

      {/* Zdjęcie produktu */}
      <div className="space-y-1">
        <Label className="text-xs">URL zdjęcia produktu (opcjonalnie)</Label>
        <div className="flex gap-2 items-center">
          <Input
            value={form.photoUrl}
            onChange={(e) => setForm({...form, photoUrl: e.target.value})}
            className="h-7 text-xs flex-1"
            placeholder="https://... lub /uploads/..."
          />
          {form.photoUrl && (
            <img
              src={form.photoUrl}
              alt=""
              className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isVisibleToClient}
            onChange={(e) => setForm({...form, isVisibleToClient: e.target.checked})}
            className="accent-red-800"
          />
          Widoczna dla klienta
        </label>
        {grossPreview > 0 && (
          <span className="text-xs font-medium text-gray-700">{grossPreview.toFixed(2)} zł brutto</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="h-6 text-xs bg-red-800 hover:bg-red-900 text-white px-2" onClick={onSave} disabled={!form.name || saving}>
          <Check className="w-3 h-3 mr-1" />{saving ? "..." : "Zapisz"}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

// ── Internal Notes ─────────────────────────────────────────────────────────────


function InternalNotesSection({ quote, onSave }: { quote: Quote; onSave: (d: Partial<Quote>) => void }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(quote.internalNotes ?? "");

  const save = () => {
    onSave({ internalNotes: notes });
    setEditing(false);
    toast.success("Notatki zapisane");
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-amber-900 text-sm">Notatki wewnętrzne</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-amber-600 hover:text-amber-800">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-sm bg-white" placeholder="Notatki widoczne tylko dla pracowników..." />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="bg-amber-700 hover:bg-amber-800 text-white">
              <Save className="w-3 h-3 mr-1" />Zapisz
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-800 whitespace-pre-wrap">
          {quote.internalNotes ?? <span className="italic opacity-60">Brak notatek</span>}
        </p>
      )}
    </div>
  );
}

// ── Create Order Dialog ───────────────────────────────────────────────────────

const ORDER_TYPES = [
  { value: "MONTAZ",       label: "Montaż systemu" },
  { value: "AWARIA",       label: "Awaria / naprawa" },
  { value: "KONSERWACJA",  label: "Konserwacja" },
  { value: "MODERNIZACJA", label: "Modernizacja" },
  { value: "INNE",         label: "Inne" },
];

function CreateOrderDialog({
  open, onClose, quoteId, defaultOrderType,
}: {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  defaultOrderType: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    orderType: defaultOrderType,
    scheduledAt: "",
    title: "",
    note: "",
  });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: form.orderType,
          scheduledAt: form.scheduledAt || undefined,
          title: form.title || undefined,
          note: form.note || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Zlecenie ${data.orderNumber} zostało utworzone`);
      onClose();
      router.push(`/orders/${data.orderId}`);
    } catch {
      toast.error("Nie udało się utworzyć zlecenia");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Utwórz zlecenie z wyceny</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Typ zlecenia</Label>
            <Select value={form.orderType} onValueChange={(v) => setForm(p => ({...p, orderType: v}))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tytuł (opcjonalnie)</Label>
            <Input value={form.title} onChange={(e) => setForm(p => ({...p, title: e.target.value}))} placeholder="Zostanie uzupełniony automatycznie" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Planowana data montażu</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm(p => ({...p, scheduledAt: e.target.value}))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notatka dla serwisanta</Label>
            <Textarea value={form.note} onChange={(e) => setForm(p => ({...p, note: e.target.value}))} rows={2} className="text-sm" placeholder="Dodatkowe instrukcje..." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Anuluj</Button>
          <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={create} disabled={creating}>
            <Wrench className="w-3.5 h-3.5 mr-1.5" />
            {creating ? "Tworzenie..." : "Utwórz zlecenie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
