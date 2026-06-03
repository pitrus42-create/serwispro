"use client";

import { useState, useRef, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, FileText, Edit2, Check, X,
  Camera, History, MessageSquare, Receipt, Wrench, Plus, Trash2, Save,
  Star, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

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
  DOMOFON: "Domofon / wideodomofon",
  SIEC: "Sieć LAN / Wi-Fi",
  AWARIA: "Awaria systemu",
  KONSERWACJA: "Konserwacja systemu",
  MODERNIZACJA: "Modernizacja systemu",
  INNE: "Inne",
};

const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  ELEWACJA: "Elewacja budynku",
  KAMERA: "Miejsce kamery",
  CZUJKA: "Miejsce czujki",
  CENTRALA: "Centrala alarmowa",
  REJESTRATOR: "Rejestrator / szafa rack",
  TRASY: "Trasy kablowe",
  ROZDZIELNIA: "Rozdzielnia elektryczna",
  BRAMA: "Brama / furtka",
  PLAN: "Plan budynku",
  INNE: "Inne",
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  TELEFON: "Telefon",
  EMAIL: "Email",
  SMS: "SMS",
  SPOTKANIE: "Spotkanie",
  INNE: "Inny kontakt",
};

const CHANGE_TYPE_ICONS: Record<string, string> = {
  CREATED: "🟢",
  STATUS_CHANGE: "🔄",
  FIELD_UPDATE: "✏️",
  PHOTO_ADDED: "📷",
  PHOTO_REMOVED: "🗑️",
  NOTE_ADDED: "📝",
  CONTACT_LOG: "📞",
  CONVERTED: "🤝",
};

const PRIORITY_LABELS: Record<string, string> = {
  NAJNIZSZA_CENA: "Najniższa cena",
  CENA_JAKOSC: "Cena / jakość",
  ESTETYKA: "Estetyka",
  NIEZAWODNOSC: "Niezawodność",
  SPRZET: "Profesjonalny sprzęt",
  ROZBUDOWA: "Możliwość rozbudowy",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inquiry {
  id: string;
  inquiryNumber: string;
  status: string;
  serviceType: string;
  source: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  nip: string | null;
  investmentAddress: string | null;
  investmentCity: string | null;
  investmentPostal: string | null;
  formAnswers: string;
  aestheticsScale: number | null;
  priorities: string;
  expectedDate: string | null;
  budgetRange: string | null;
  internalNotes: string | null;
  convertedToClient: boolean;
  createdAt: string;
  updatedAt: string;
  photos: InquiryPhoto[];
  changeLogs: ChangeLog[];
  contactLogs: ContactLog[];
  quotes: Quote[];
  client: { id: string; name: string | null } | null;
}

interface InquiryPhoto {
  id: string;
  fileUrl: string;
  fileName: string | null;
  category: string | null;
  description: string | null;
  addedBy: string | null;
  addedAt: string;
}

interface ChangeLog {
  id: string;
  actorLabel: string;
  changeType: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface ContactLog {
  id: string;
  contactType: string;
  contactDate: string;
  contactPerson: string | null;
  note: string | null;
  outcome: string | null;
  isAboutQuote: boolean;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  createdAt: string;
  packages: { packageType: string; grossTotal: number }[];
  acceptance: { acceptedPackage: string } | null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ["inquiry", id],
    queryFn: async () => {
      const res = await fetch(`/api/inquiries/${id}`);
      if (!res.ok) throw new Error("Błąd pobierania");
      return res.json() as Promise<Inquiry>;
    },
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/inquiries/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Błąd zmiany statusu");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inquiry", id] });
      toast.success("Status zaktualizowany");
    },
    onError: () => toast.error("Nie udało się zmienić statusu"),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg w-64 animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Zapytanie nie zostało znalezione</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/inquiries")}>
          Wróć do listy
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/inquiries")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-gray-400">{inquiry.inquiryNumber}</span>
                <Badge className={cn("text-xs", STATUS_COLORS[inquiry.status] ?? "bg-gray-100")}>
                  {STATUS_LABELS[inquiry.status] ?? inquiry.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {SERVICE_TYPE_LABELS[inquiry.serviceType] ?? inquiry.serviceType}
                </Badge>
              </div>
              <h1 className="font-semibold text-gray-900 mt-0.5">{inquiry.contactName}</h1>
            </div>
          </div>

          {/* Status dropdown */}
          <div className="relative">
            <Select
              value={inquiry.status}
              onValueChange={(v) => changeStatus.mutate(v)}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="summary" className="h-full flex flex-col">
          <TabsList className="px-4 md:px-6 py-0 h-10 border-b border-gray-200 bg-white rounded-none justify-start gap-1 overflow-x-auto flex-shrink-0 w-full">
            <TabsTrigger value="summary" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Podsumowanie
            </TabsTrigger>
            <TabsTrigger value="form" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Formularz
            </TabsTrigger>
            <TabsTrigger value="photos" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Zdjęcia {inquiry.photos.length > 0 && `(${inquiry.photos.length})`}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Historia
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Kontakt {inquiry.contactLogs.length > 0 && `(${inquiry.contactLogs.length})`}
            </TabsTrigger>
            <TabsTrigger value="quotes" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Wyceny {inquiry.quotes.length > 0 && `(${inquiry.quotes.length})`}
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs data-[state=active]:bg-red-50 data-[state=active]:text-red-900 rounded-md">
              Zlecenia
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* ── Podsumowanie ────────────────────────────────────────────── */}
            <TabsContent value="summary" className="m-0 p-4 md:p-6 space-y-4">
              <SummaryTab inquiry={inquiry} onUpdate={() => qc.invalidateQueries({ queryKey: ["inquiry", id] })} />
            </TabsContent>

            {/* ── Formularz ───────────────────────────────────────────────── */}
            <TabsContent value="form" className="m-0 p-4 md:p-6">
              <FormTab inquiry={inquiry} onUpdate={() => qc.invalidateQueries({ queryKey: ["inquiry", id] })} />
            </TabsContent>

            {/* ── Zdjęcia ─────────────────────────────────────────────────── */}
            <TabsContent value="photos" className="m-0 p-4 md:p-6">
              <PhotosTab inquiry={inquiry} onUpdate={() => qc.invalidateQueries({ queryKey: ["inquiry", id] })} />
            </TabsContent>

            {/* ── Historia ────────────────────────────────────────────────── */}
            <TabsContent value="history" className="m-0 p-4 md:p-6">
              <HistoryTab logs={inquiry.changeLogs} />
            </TabsContent>

            {/* ── Kontakt ─────────────────────────────────────────────────── */}
            <TabsContent value="contact" className="m-0 p-4 md:p-6">
              <ContactTab
                inquiryId={id}
                logs={inquiry.contactLogs}
                onUpdate={() => qc.invalidateQueries({ queryKey: ["inquiry", id] })}
              />
            </TabsContent>

            {/* ── Wyceny ──────────────────────────────────────────────────── */}
            <TabsContent value="quotes" className="m-0 p-4 md:p-6">
              <QuotesTab inquiryId={id} quotes={inquiry.quotes} />
            </TabsContent>

            {/* ── Zlecenia ────────────────────────────────────────────────── */}
            <TabsContent value="orders" className="m-0 p-4 md:p-6">
              <div className="text-center py-12 text-gray-400">
                <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Tworzenie zlecenia z wyceny — dostępne w Etapie 5</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ── Tab: Podsumowanie ─────────────────────────────────────────────────────────

function SummaryTab({ inquiry, onUpdate }: { inquiry: Inquiry; onUpdate: () => void }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(inquiry.internalNotes ?? "");

  const saveNotes = async () => {
    await fetch(`/api/inquiries/${inquiry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalNotes: notes }),
    });
    toast.success("Notatki zapisane");
    setEditingNotes(false);
    onUpdate();
  };

  const priorities: string[] = (() => {
    try { return JSON.parse(inquiry.priorities); } catch { return []; }
  })();

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Dane kontaktowe */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900 text-sm">Dane kontaktowe</h3>
        <div className="space-y-2">
          <InfoRow icon={<FileText className="w-4 h-4" />} label="Osoba" value={inquiry.contactName} />
          {inquiry.companyName && (
            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Firma" value={inquiry.companyName} />
          )}
          {inquiry.nip && (
            <InfoRow icon={<FileText className="w-4 h-4" />} label="NIP" value={inquiry.nip} />
          )}
          {inquiry.contactPhone && (
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefon" value={
              <a href={`tel:${inquiry.contactPhone}`} className="text-red-800 hover:underline">
                {inquiry.contactPhone}
              </a>
            } />
          )}
          {inquiry.contactEmail && (
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={
              <a href={`mailto:${inquiry.contactEmail}`} className="text-red-800 hover:underline">
                {inquiry.contactEmail}
              </a>
            } />
          )}
        </div>
      </div>

      {/* Adres inwestycji */}
      {(inquiry.investmentAddress || inquiry.investmentCity) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-gray-900 text-sm">Adres inwestycji</h3>
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="Adres" value={
            [inquiry.investmentAddress, inquiry.investmentPostal, inquiry.investmentCity]
              .filter(Boolean).join(", ")
          } />
        </div>
      )}

      {/* Preferencje */}
      {(inquiry.aestheticsScale !== null || priorities.length > 0 || inquiry.budgetRange || inquiry.expectedDate) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-900 text-sm">Preferencje klienta</h3>
          {inquiry.aestheticsScale !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Skala estetyki montażu</span>
                <span className="font-semibold text-red-800">{inquiry.aestheticsScale}/10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-800 h-2 rounded-full"
                  style={{ width: `${inquiry.aestheticsScale * 10}%` }}
                />
              </div>
            </div>
          )}
          {priorities.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-1.5">Priorytety</p>
              <div className="flex flex-wrap gap-1.5">
                {priorities.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">
                    {PRIORITY_LABELS[p] ?? p}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {inquiry.expectedDate && (
            <InfoRow icon={<FileText className="w-4 h-4" />} label="Oczekiwany termin" value={inquiry.expectedDate} />
          )}
          {inquiry.budgetRange && (
            <InfoRow icon={<FileText className="w-4 h-4" />} label="Budżet" value={inquiry.budgetRange} />
          )}
        </div>
      )}

      {/* Notatki wewnętrzne */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-amber-900 text-sm">Notatki wewnętrzne</h3>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="text-amber-700 hover:text-amber-900">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm bg-white"
              placeholder="Notatki widoczne tylko dla pracowników..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNotes} className="bg-amber-700 hover:bg-amber-800 text-white">
                <Save className="w-3 h-3 mr-1" /> Zapisz
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-800 whitespace-pre-wrap">
            {inquiry.internalNotes ?? <span className="italic opacity-60">Brak notatek</span>}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>Źródło: {inquiry.source}</p>
        <p>Utworzono: {format(new Date(inquiry.createdAt), "d MMMM yyyy, HH:mm", { locale: pl })}</p>
        <p>Ostatnia aktualizacja: {format(new Date(inquiry.updatedAt), "d MMMM yyyy, HH:mm", { locale: pl })}</p>
        {inquiry.client && (
          <p className="text-green-700">✓ Powiązano z klientem: {inquiry.client.name}</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-500">{label}: </span>
        <span className="text-sm text-gray-900">{value}</span>
      </div>
    </div>
  );
}

// ── Tab: Formularz ────────────────────────────────────────────────────────────

function FormTab({ inquiry, onUpdate }: { inquiry: Inquiry; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contactName: inquiry.contactName,
    contactPhone: inquiry.contactPhone ?? "",
    contactEmail: inquiry.contactEmail ?? "",
    companyName: inquiry.companyName ?? "",
    nip: inquiry.nip ?? "",
    investmentAddress: inquiry.investmentAddress ?? "",
    investmentCity: inquiry.investmentCity ?? "",
    investmentPostal: inquiry.investmentPostal ?? "",
    expectedDate: inquiry.expectedDate ?? "",
    budgetRange: inquiry.budgetRange ?? "",
  });

  const save = async () => {
    await fetch(`/api/inquiries/${inquiry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    toast.success("Zapisano dane");
    setEditing(false);
    onUpdate();
  };

  if (!editing) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edytuj dane
          </Button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Imię i nazwisko" value={inquiry.contactName} />
          <Field label="Telefon" value={inquiry.contactPhone} />
          <Field label="Email" value={inquiry.contactEmail} />
          <Field label="Firma" value={inquiry.companyName} />
          <Field label="NIP" value={inquiry.nip} />
          <Field label="Adres" value={inquiry.investmentAddress} />
          <Field label="Miasto" value={inquiry.investmentCity} />
          <Field label="Kod pocztowy" value={inquiry.investmentPostal} />
          <Field label="Oczekiwany termin" value={inquiry.expectedDate} />
          <Field label="Budżet" value={inquiry.budgetRange} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EditField label="Imię i nazwisko" value={form.contactName} onChange={(v) => setForm(p => ({ ...p, contactName: v }))} />
        <EditField label="Telefon" value={form.contactPhone} onChange={(v) => setForm(p => ({ ...p, contactPhone: v }))} />
        <EditField label="Email" value={form.contactEmail} onChange={(v) => setForm(p => ({ ...p, contactEmail: v }))} />
        <EditField label="Firma" value={form.companyName} onChange={(v) => setForm(p => ({ ...p, companyName: v }))} />
        <EditField label="NIP" value={form.nip} onChange={(v) => setForm(p => ({ ...p, nip: v }))} />
        <EditField label="Adres" value={form.investmentAddress} onChange={(v) => setForm(p => ({ ...p, investmentAddress: v }))} />
        <EditField label="Miasto" value={form.investmentCity} onChange={(v) => setForm(p => ({ ...p, investmentCity: v }))} />
        <EditField label="Kod pocztowy" value={form.investmentPostal} onChange={(v) => setForm(p => ({ ...p, investmentPostal: v }))} />
        <EditField label="Oczekiwany termin" value={form.expectedDate} onChange={(v) => setForm(p => ({ ...p, expectedDate: v }))} />
        <EditField label="Budżet" value={form.budgetRange} onChange={(v) => setForm(p => ({ ...p, budgetRange: v }))} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="bg-red-800 hover:bg-red-900 text-white">
          <Save className="w-3 h-3 mr-1" /> Zapisz
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Anuluj</Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value || <span className="italic text-gray-400">—</span>}</p>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

// ── Tab: Zdjęcia ──────────────────────────────────────────────────────────────

function PhotosTab({ inquiry, onUpdate }: { inquiry: Inquiry; onUpdate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("INNE");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<InquiryPhoto | null>(null);

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("photos", f));
      fd.append("category", category);
      if (description) fd.append("description", description);
      const res = await fetch(`/api/inquiries/${inquiry.id}/photos`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      toast.success("Zdjęcia dodane");
      onUpdate();
      setDescription("");
    } catch {
      toast.error("Błąd uploadu");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (pid: string) => {
    await fetch(`/api/inquiries/${inquiry.id}/photos/${pid}`, { method: "DELETE" });
    toast.success("Zdjęcie usunięte");
    onUpdate();
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* Upload form */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900 text-sm">Dodaj zdjęcia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Kategoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PHOTO_CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Opis (opcjonalnie)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs"
              placeholder="np. ściana wschodnia"
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="w-4 h-4 mr-2" />
          {uploading ? "Wysyłanie..." : "Wybierz zdjęcia"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {/* Photos grid */}
      {inquiry.photos.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Brak zdjęć</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {inquiry.photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <button className="block w-full" onClick={() => setPreview(photo)}>
                <img
                  src={photo.fileUrl}
                  alt={photo.fileName ?? "zdjęcie"}
                  className="w-full aspect-square object-cover"
                />
              </button>
              <div className="p-1.5">
                <p className="text-xs text-gray-600 truncate">
                  {PHOTO_CATEGORY_LABELS[photo.category ?? ""] ?? photo.category ?? "—"}
                </p>
                {photo.description && (
                  <p className="text-xs text-gray-400 truncate">{photo.description}</p>
                )}
              </div>
              <button
                onClick={() => deletePhoto(photo.id)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {preview ? (PHOTO_CATEGORY_LABELS[preview.category ?? ""] ?? preview.category) : ""}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div>
              <img src={preview.fileUrl} alt="" className="w-full rounded-lg object-contain max-h-96" />
              {preview.description && (
                <p className="text-sm text-gray-600 mt-2">{preview.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(preview.addedAt), "d MMMM yyyy, HH:mm", { locale: pl })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab: Historia ─────────────────────────────────────────────────────────────

function HistoryTab({ logs }: { logs: ChangeLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Brak historii</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-0">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0">
              {CHANGE_TYPE_ICONS[log.changeType] ?? "•"}
            </div>
            {i < logs.length - 1 && <div className="w-px bg-gray-200 flex-1 my-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-900">{log.actorLabel}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(log.createdAt), "d MMM yyyy, HH:mm", { locale: pl })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
            {log.oldValue && log.newValue && (
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="line-through">{log.oldValue}</span>
                {" → "}
                <span className="text-gray-700">{log.newValue}</span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Kontakt ──────────────────────────────────────────────────────────────

function ContactTab({
  inquiryId,
  logs,
  onUpdate,
}: {
  inquiryId: string;
  logs: ContactLog[];
  onUpdate: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contactType: "TELEFON",
    contactDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    note: "",
    outcome: "",
    isAboutQuote: false,
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/contact-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Kontakt zapisany");
      setShowForm(false);
      setForm({ contactType: "TELEFON", contactDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), note: "", outcome: "", isAboutQuote: false });
      onUpdate();
    } catch {
      toast.error("Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Button
        size="sm"
        onClick={() => setShowForm(!showForm)}
        className="bg-red-800 hover:bg-red-900 text-white"
      >
        <Plus className="w-4 h-4 mr-1" />
        Dodaj kontakt
      </Button>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm text-gray-900">Nowy wpis kontaktowy</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Typ kontaktu</Label>
              <Select value={form.contactType} onValueChange={(v) => setForm(p => ({ ...p, contactType: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data i godzina</Label>
              <Input
                type="datetime-local"
                value={form.contactDate}
                onChange={(e) => setForm(p => ({ ...p, contactDate: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notatka z rozmowy</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
              rows={2}
              className="text-sm"
              placeholder="Treść rozmowy..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wynik / następny krok</Label>
            <Input
              value={form.outcome}
              onChange={(e) => setForm(p => ({ ...p, outcome: e.target.value }))}
              className="h-8 text-sm"
              placeholder="np. Klient zainteresowany, czeka na wycenę"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAboutQuote}
              onChange={(e) => setForm(p => ({ ...p, isAboutQuote: e.target.checked }))}
              className="rounded"
            />
            Dotyczy akceptacji wyceny
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="bg-red-800 hover:bg-red-900 text-white">
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Anuluj</Button>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Brak historii kontaktu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {CONTACT_TYPE_LABELS[log.contactType] ?? log.contactType}
                  </Badge>
                  {log.isAboutQuote && (
                    <Badge className="text-xs bg-green-100 text-green-800">dot. wyceny</Badge>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(log.contactDate), "d MMM yyyy, HH:mm", { locale: pl })}
                </span>
              </div>
              {log.contactPerson && (
                <p className="text-xs text-gray-500">Kontaktował(a): {log.contactPerson}</p>
              )}
              {log.note && <p className="text-sm text-gray-700">{log.note}</p>}
              {log.outcome && (
                <p className="text-sm font-medium text-gray-900 border-t border-gray-100 pt-1.5">
                  → {log.outcome}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Wyceny ───────────────────────────────────────────────────────────────

function QuotesTab({ inquiryId, quotes }: { inquiryId: string; quotes: Quote[] }) {
  const QUOTE_STATUS_LABELS: Record<string, string> = {
    ROBOCZA: "Robocza",
    GOTOWA: "Gotowa",
    WYSLANA: "Wysłana",
    ZAAKCEPTOWANA_TEL: "Zaakceptowana (tel.)",
    ZAAKCEPTOWANA_MAIL: "Zaakceptowana (email)",
    ODRZUCONA: "Odrzucona",
    WYGASLA: "Wygasła",
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {quotes.length === 0 ? "Brak wycen" : `${quotes.length} wycen(a)`}
        </p>
        <Button size="sm" variant="outline" disabled title="Dostępne w Etapie 3">
          <Plus className="w-4 h-4 mr-1" />
          Utwórz wycenę
        </Button>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Brak wycen</p>
          <p className="text-xs mt-1">Tworzenie wycen — Etap 3</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{q.quoteNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(q.createdAt), "d MMM yyyy", { locale: pl })}
                </span>
              </div>
              {q.acceptance && (
                <p className="text-xs text-green-700 mt-1">
                  ✓ Zaakceptowany pakiet: {q.acceptance.acceptedPackage}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
