"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight, ChevronLeft, Check, Camera, Upload, X, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoFile {
  file: File;
  preview: string;
  category: string;
  description: string;
}

interface FormData {
  // Krok 1
  serviceType: string;
  // Krok 2 — pytania zależne od typu
  specificAnswers: Record<string, string>;
  // Krok 3 — dane obiektu
  objectType: string;
  objectCondition: string;
  hasCabling: string;
  investmentAddress: string;
  investmentCity: string;
  investmentPostal: string;
  expectedDate: string;
  budgetRange: string;
  // Krok 4 — preferencje
  aestheticsScale: number;
  priorities: string[];
  // Krok 5 — dane kontaktowe
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  companyName: string;
  nip: string;
  agreeContact: boolean;
  agreeRodo: boolean;
  // Krok 6 — zdjęcia (przechowywane osobno)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: "CCTV",        label: "Monitoring CCTV",          icon: "📷", desc: "Kamery, rejestratory, systemy nadzoru" },
  { value: "ALARM",       label: "Alarm",                    icon: "🔔", desc: "Systemy antywłamaniowe, czujniki" },
  { value: "BRAMA",       label: "Automatyka bramowa",        icon: "🚪", desc: "Bramy, szlabany, napędy" },
  { value: "DOMOFON",     label: "Domofon / wideodomofon",   icon: "🏠", desc: "Domofonowe systemy wejścia" },
  { value: "SIEC",        label: "Sieć LAN / Wi-Fi",         icon: "📡", desc: "Okablowanie, routery, szafy rack" },
  { value: "AWARIA",      label: "Awaria systemu",            icon: "⚡", desc: "Naprawa niedziałającego systemu" },
  { value: "KONSERWACJA", label: "Konserwacja",              icon: "🔧", desc: "Przegląd i serwis systemu" },
  { value: "MODERNIZACJA",label: "Modernizacja",             icon: "⬆️", desc: "Rozbudowa lub wymiana istniejącego" },
  { value: "INNE",        label: "Inne",                     icon: "💬", desc: "Inne usługi i konsultacje" },
];

const SPECIFIC_QUESTIONS: Record<string, { id: string; question: string; type: "text" | "select" | "number"; options?: string[] }[]> = {
  CCTV: [
    { id: "objectSize", question: "Jak duży jest obiekt?", type: "select", options: ["Małe (dom/mieszkanie)", "Średnie (firma, sklep)", "Duże (magazyn, budynek)", "Bardzo duże (teren zewnętrzny)"] },
    { id: "cameraCount", question: "Orientacyjna liczba kamer", type: "select", options: ["1-3", "4-8", "9-16", "Powyżej 16", "Nie wiem — potrzebuję doradztwa"] },
    { id: "cameraLocation", question: "Gdzie mają być kamery?", type: "select", options: ["Tylko wewnątrz", "Tylko na zewnątrz", "Wewnątrz i na zewnątrz"] },
    { id: "remoteAccess", question: "Czy potrzebny podgląd przez telefon/internet?", type: "select", options: ["Tak, to ważne", "Miło by było", "Nie jest potrzebny"] },
    { id: "existingSystem", question: "Czy masz już jakiś system CCTV?", type: "select", options: ["Nie, to nowy montaż", "Tak, chcę rozbudować", "Tak, chcę wymienić"] },
  ],
  ALARM: [
    { id: "objectSize", question: "Jak duży jest obiekt?", type: "select", options: ["Dom jednorodzinny", "Mieszkanie", "Firma/biuro", "Magazyn/hala", "Inny"] },
    { id: "sensorCount", question: "Orientacyjna liczba stref/czujników", type: "select", options: ["1-4", "5-10", "11-20", "Powyżej 20", "Nie wiem"] },
    { id: "monitoring", question: "Czy potrzebny monitoring przez centrum alarmowe?", type: "select", options: ["Tak", "Nie", "Nie wiem, chcę doradztwo"] },
    { id: "existingSystem", question: "Czy masz już alarm?", type: "select", options: ["Nie, to nowy montaż", "Tak, chcę rozbudować", "Tak, chcę wymienić"] },
  ],
  BRAMA: [
    { id: "gateType", question: "Typ bramy / wjazdu", type: "select", options: ["Brama przesuwna", "Brama skrzydłowa", "Brama garażowa segmentowa", "Brama garażowa uchylna", "Szlaban", "Furtka"] },
    { id: "gateWidth", question: "Szerokość wjazdu (orientacyjnie)", type: "text" },
    { id: "intercom", question: "Czy potrzebny domofon / wideodomofon przy bramie?", type: "select", options: ["Tak", "Nie"] },
    { id: "existingGate", question: "Stan bramy", type: "select", options: ["Brama jest, potrzebuję napędu", "Brama jest z napędem — modernizacja", "Potrzebuję całą bramę z napędem"] },
  ],
  DOMOFON: [
    { id: "type", question: "Typ systemu", type: "select", options: ["Domofon audio (bez obrazu)", "Wideodomofon (z kamerą)", "Wideodomofon z rejestracją"] },
    { id: "units", question: "Liczba lokali / mieszkań", type: "select", options: ["1 (dom prywatny)", "2-5", "6-20", "Powyżej 20"] },
    { id: "hasCabling", question: "Czy jest istniejące okablowanie domofonowe?", type: "select", options: ["Tak", "Nie", "Nie wiem"] },
  ],
  SIEC: [
    { id: "scope", question: "Co jest potrzebne?", type: "select", options: ["Okablowanie LAN", "Wi-Fi (access pointy)", "Szafa rack / patch panel", "Kompleksowa sieć LAN+Wi-Fi", "Inne"] },
    { id: "points", question: "Orientacyjna liczba punktów sieciowych", type: "select", options: ["1-5", "6-15", "16-30", "Powyżej 30", "Nie wiem"] },
    { id: "internetSpeed", question: "Posiadane łącze internetowe", type: "select", options: ["Do 100 Mb/s", "100-500 Mb/s", "Powyżej 500 Mb/s (gigabit)", "Nie mam jeszcze łącza"] },
  ],
  AWARIA: [
    { id: "systemType", question: "Jaki system nie działa?", type: "select", options: ["CCTV / Monitoring", "Alarm", "Brama / napęd", "Domofon", "Sieć LAN / Wi-Fi", "Inne"] },
    { id: "problemDesc", question: "Opisz problem / awarię", type: "text" },
    { id: "urgency", question: "Pilność naprawy", type: "select", options: ["Bardzo pilne — dzisiaj/jutro", "Pilne — w tym tygodniu", "Normalne — w ciągu 2 tygodni"] },
  ],
  KONSERWACJA: [
    { id: "systemType", question: "Jaki system wymaga konserwacji?", type: "select", options: ["CCTV / Monitoring", "Alarm", "Brama / napęd", "Domofon", "Kilka systemów", "Inne"] },
    { id: "lastService", question: "Kiedy była ostatnia konserwacja?", type: "select", options: ["Nigdy / nie wiem", "Ponad 2 lata temu", "1-2 lata temu", "Mniej niż rok temu"] },
  ],
  MODERNIZACJA: [
    { id: "systemType", question: "Jaki system do modernizacji?", type: "select", options: ["CCTV / Monitoring", "Alarm", "Brama / napęd", "Domofon", "Sieć", "Kilka systemów"] },
    { id: "reason", question: "Powód modernizacji", type: "select", options: ["Przestarzały sprzęt", "Rozbudowa — więcej urządzeń", "Lepsze możliwości (zdalny dostęp itp.)", "Wymagania ubezpieczyciela", "Inne"] },
  ],
  INNE: [
    { id: "description", question: "Opisz czego potrzebujesz", type: "text" },
  ],
};

const OBJECT_TYPES = ["Dom jednorodzinny", "Mieszkanie", "Firma / biuro", "Sklep / lokal usługowy", "Magazyn / hala", "Budynek wielorodzinny", "Teren zewnętrzny", "Inne"];
const OBJECT_CONDITIONS = ["Nowy — budowa", "Stan surowy", "W remoncie", "Wykończony / gotowy"];
const PRIORITIES = [
  { value: "NAJNIZSZA_CENA",  label: "Najniższa cena" },
  { value: "CENA_JAKOSC",     label: "Cena / jakość" },
  { value: "ESTETYKA",        label: "Estetyka montażu" },
  { value: "NIEZAWODNOSC",    label: "Niezawodność" },
  { value: "SPRZET",          label: "Profesjonalny sprzęt" },
  { value: "ROZBUDOWA",       label: "Możliwość rozbudowy" },
];

const PHOTO_CATEGORIES = [
  { value: "ELEWACJA",    label: "Elewacja budynku",   hint: "Zrób zdjęcie z większej odległości — widoczna fasada i wejście" },
  { value: "KAMERA",      label: "Miejsce kamery",      hint: "Pokaż ścianę / narożnik gdzie ma wisieć kamera" },
  { value: "CZUJKA",      label: "Miejsce czujki",      hint: "Pokaż ścianę lub sufit gdzie planowana jest czujka" },
  { value: "CENTRALA",    label: "Centrala alarmowa",   hint: "Pokaż miejsce gdzie mogłaby być centrala / rejestrator" },
  { value: "REJESTRATOR", label: "Rejestrator / rack",  hint: "Miejsce na rejestrator lub szafę rack" },
  { value: "TRASY",       label: "Trasy kablowe",       hint: "Pokaż ściany, sufity, korytarze gdzie pójdą kable" },
  { value: "ROZDZIELNIA", label: "Rozdzielnia el.",      hint: "Zdjęcie rozdzielnicy elektrycznej i zasilania" },
  { value: "BRAMA",       label: "Brama / furtka",      hint: "Brama lub wejście do obiektu" },
  { value: "PLAN",        label: "Plan budynku",        hint: "Rzut kondygnacji lub schemat obiektu" },
  { value: "INNE",        label: "Inne",               hint: "Inne przydatne zdjęcia" },
];

const STEPS = [
  "Typ usługi",
  "Szczegóły",
  "Obiekt",
  "Preferencje",
  "Dane kontaktowe",
  "Zdjęcia",
  "Potwierdzenie",
];

// ── Component ─────────────────────────────────────────────────────────────────

const emptyForm: FormData = {
  serviceType: "",
  specificAnswers: {},
  objectType: "",
  objectCondition: "",
  hasCabling: "",
  investmentAddress: "",
  investmentCity: "",
  investmentPostal: "",
  expectedDate: "",
  budgetRange: "",
  aestheticsScale: 5,
  priorities: [],
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  companyName: "",
  nip: "",
  agreeContact: false,
  agreeRodo: false,
};

export default function PublicInquiryPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ token: string; number: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newPhotoCategory, setNewPhotoCategory] = useState("ELEWACJA");

  const set = (field: keyof FormData, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const togglePriority = (val: string) =>
    set("priorities", form.priorities.includes(val)
      ? form.priorities.filter((p) => p !== val)
      : [...form.priorities, val]);

  const canNext = () => {
    if (step === 0) return !!form.serviceType;
    if (step === 4) return !!form.contactName && !!form.contactPhone && form.agreeContact && form.agreeRodo;
    return true;
  };

  const addPhotos = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos((p) => [...p, {
          file,
          preview: e.target?.result as string,
          category: newPhotoCategory,
          description: "",
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: form.serviceType,
          source: "FORMULARZ",
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail || undefined,
          companyName: form.companyName || undefined,
          nip: form.nip || undefined,
          investmentAddress: form.investmentAddress || undefined,
          investmentCity: form.investmentCity || undefined,
          investmentPostal: form.investmentPostal || undefined,
          formAnswers: {
            specificAnswers: form.specificAnswers,
            objectType: form.objectType,
            objectCondition: form.objectCondition,
            hasCabling: form.hasCabling,
          },
          aestheticsScale: form.aestheticsScale,
          priorities: form.priorities,
          expectedDate: form.expectedDate || undefined,
          budgetRange: form.budgetRange || undefined,
        }),
      });

      if (!res.ok) throw new Error("Błąd wysyłania");
      const inquiry = await res.json();

      // Upload photos
      if (photos.length > 0) {
        const fd = new FormData();
        photos.forEach((p) => fd.append("photos", p.file));
        fd.append("categories", JSON.stringify(photos.map((p) => p.category)));
        fd.append("descriptions", JSON.stringify(photos.map((p) => p.description)));
        await fetch(`/api/public/inquiry/${inquiry.publicToken}/photos`, {
          method: "POST",
          body: fd,
        });
      }

      setSubmitted({ token: inquiry.publicToken, number: inquiry.inquiryNumber });
    } catch {
      toast.error("Nie udało się wysłać zapytania. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SuccessPage token={submitted.token} number={submitted.number} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none">All-Secure</p>
            <p className="text-xs text-gray-500">Formularz zapytania ofertowego</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Krok {step + 1} z {STEPS.length}</span>
            <span className="text-xs font-medium text-gray-700">{STEPS[step]}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-800 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-6 pb-24">
        {step === 0 && <Step1 form={form} set={set} />}
        {step === 1 && <Step2 form={form} set={set} />}
        {step === 2 && <Step3 form={form} set={set} />}
        {step === 3 && <Step4 form={form} set={set} togglePriority={togglePriority} />}
        {step === 4 && <Step5 form={form} set={set} />}
        {step === 5 && (
          <Step6
            photos={photos}
            setPhotos={setPhotos}
            fileRef={fileRef}
            addPhotos={addPhotos}
            newPhotoCategory={newPhotoCategory}
            setNewPhotoCategory={setNewPhotoCategory}
            serviceType={form.serviceType}
          />
        )}
        {step === 6 && <Step7 form={form} photos={photos} />}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
        <div className="max-w-xl mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Wstecz
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              className={cn("flex-1 bg-red-800 hover:bg-red-900 text-white", step === 0 && "w-full")}
              disabled={!canNext()}
              onClick={() => setStep(s => s + 1)}
            >
              Dalej
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="flex-1 bg-green-700 hover:bg-green-800 text-white"
              disabled={submitting || !form.agreeContact || !form.agreeRodo}
              onClick={handleSubmit}
            >
              {submitting ? "Wysyłanie..." : "Wyślij zapytanie"}
              {!submitting && <Check className="w-4 h-4 ml-1" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Typ usługi ────────────────────────────────────────────────────────

function Step1({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Czego potrzebujesz?</h2>
        <p className="text-sm text-gray-500 mt-1">Wybierz typ usługi, a dostosujemy pytania do Twoich potrzeb</p>
      </div>
      <div className="space-y-2">
        {SERVICE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { set("serviceType", t.value); set("specificAnswers", {}); }}
            className={cn(
              "w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3",
              form.serviceType === t.value
                ? "border-red-800 bg-red-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <span className="text-2xl">{t.icon}</span>
            <div>
              <p className={cn("font-medium", form.serviceType === t.value ? "text-red-900" : "text-gray-900")}>
                {t.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Pytania szczegółowe ───────────────────────────────────────────────

function Step2({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const questions = SPECIFIC_QUESTIONS[form.serviceType] ?? [];
  const serviceLabel = SERVICE_TYPES.find(t => t.value === form.serviceType)?.label ?? "";

  const setAnswer = (id: string, value: string) =>
    set("specificAnswers", { ...form.specificAnswers, [id]: value });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Kilka pytań o {serviceLabel.toLowerCase()}</h2>
        <p className="text-sm text-gray-500 mt-1">Dzięki temu przygotujemy dokładną wycenę</p>
      </div>
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label className="text-sm font-medium text-gray-800">{q.question}</Label>
          {q.type === "select" && q.options ? (
            <div className="space-y-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswer(q.id, opt)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors",
                    form.specificAnswers[q.id] === opt
                      ? "border-red-800 bg-red-50 text-red-900 font-medium"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <Textarea
              value={form.specificAnswers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="Opisz..."
              rows={3}
              className="text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 3: Dane obiektu ──────────────────────────────────────────────────────

function Step3({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Informacje o obiekcie</h2>
        <p className="text-sm text-gray-500 mt-1">Pomogą nam zaplanować zakres prac</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Typ obiektu</Label>
        <div className="grid grid-cols-2 gap-2">
          {OBJECT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => set("objectType", t)}
              className={cn(
                "text-sm p-2.5 rounded-lg border text-left transition-colors",
                form.objectType === t
                  ? "border-red-800 bg-red-50 text-red-900 font-medium"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Stan obiektu</Label>
        <div className="grid grid-cols-2 gap-2">
          {OBJECT_CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => set("objectCondition", c)}
              className={cn(
                "text-sm p-2.5 rounded-lg border text-left transition-colors",
                form.objectCondition === c
                  ? "border-red-800 bg-red-50 text-red-900 font-medium"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Czy jest instalacja kablowa?</Label>
        <div className="flex gap-2">
          {["Tak", "Nie", "Nie wiem"].map((v) => (
            <button
              key={v}
              onClick={() => set("hasCabling", v)}
              className={cn(
                "flex-1 text-sm py-2 rounded-lg border transition-colors",
                form.hasCabling === v
                  ? "border-red-800 bg-red-50 text-red-900 font-medium"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Adres inwestycji</Label>
        <Input
          value={form.investmentAddress}
          onChange={(e) => set("investmentAddress", e.target.value)}
          placeholder="Ulica i numer"
          className="text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={form.investmentCity}
            onChange={(e) => set("investmentCity", e.target.value)}
            placeholder="Miejscowość"
            className="text-sm"
          />
          <Input
            value={form.investmentPostal}
            onChange={(e) => set("investmentPostal", e.target.value)}
            placeholder="Kod pocztowy"
            className="text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Oczekiwany termin realizacji</Label>
          <Input
            value={form.expectedDate}
            onChange={(e) => set("expectedDate", e.target.value)}
            placeholder="np. do końca sierpnia, ASAP"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Budżet orientacyjny (opcjonalnie)</Label>
          <Input
            value={form.budgetRange}
            onChange={(e) => set("budgetRange", e.target.value)}
            placeholder="np. 3000–6000 zł"
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Preferencje ───────────────────────────────────────────────────────

function Step4({ form, set, togglePriority }: {
  form: FormData;
  set: (k: keyof FormData, v: unknown) => void;
  togglePriority: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Twoje preferencje</h2>
        <p className="text-sm text-gray-500 mt-1">Pomożemy dobrać rozwiązanie dopasowane do Twoich oczekiwań</p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Jak ważna jest estetyka montażu?{" "}
          <span className="text-red-800 font-bold">{form.aestheticsScale}/10</span>
        </Label>
        <input
          type="range"
          min={1}
          max={10}
          value={form.aestheticsScale}
          onChange={(e) => set("aestheticsScale", parseInt(e.target.value))}
          className="w-full accent-red-800"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Budżetowy<br />(widoczne przewody)</span>
          <span className="text-center">Kompromis</span>
          <span className="text-right">Premium<br />(ukryte przewody)</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Co jest dla Ciebie najważniejsze? (możesz wybrać kilka)</Label>
        <div className="space-y-2">
          {PRIORITIES.map((p) => (
            <label key={p.value} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              style={{ borderColor: form.priorities.includes(p.value) ? "#991b1b" : undefined }}
            >
              <input
                type="checkbox"
                checked={form.priorities.includes(p.value)}
                onChange={() => togglePriority(p.value)}
                className="accent-red-800 w-4 h-4"
              />
              <span className={cn("text-sm", form.priorities.includes(p.value) ? "text-red-900 font-medium" : "text-gray-700")}>
                {p.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Dane kontaktowe ───────────────────────────────────────────────────

function Step5({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Twoje dane kontaktowe</h2>
        <p className="text-sm text-gray-500 mt-1">Skontaktujemy się, żeby omówić szczegóły i przygotować wycenę</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Imię i nazwisko *</Label>
          <Input
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="Jan Kowalski"
            className="text-base"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Telefon *</Label>
          <Input
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            placeholder="+48 600 000 000"
            type="tel"
            className="text-base"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Email (opcjonalnie)</Label>
          <Input
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="jan@przykład.pl"
            type="email"
            className="text-base"
            autoComplete="email"
            inputMode="email"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Faktura / firma (opcjonalnie)</p>
        <div className="space-y-1.5">
          <Label className="text-sm">Nazwa firmy</Label>
          <Input
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="Firma Sp. z o.o."
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">NIP</Label>
          <Input
            value={form.nip}
            onChange={(e) => set("nip", e.target.value)}
            placeholder="000-000-00-00"
            className="text-sm"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <label className="flex gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreeContact}
            onChange={(e) => set("agreeContact", e.target.checked)}
            className="mt-0.5 accent-red-800 w-4 h-4 shrink-0"
          />
          <span className="text-sm text-gray-600">
            <span className="text-red-600">*</span> Wyrażam zgodę na kontakt w celu przygotowania wyceny i omówienia szczegółów zapytania.
          </span>
        </label>
        <label className="flex gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreeRodo}
            onChange={(e) => set("agreeRodo", e.target.checked)}
            className="mt-0.5 accent-red-800 w-4 h-4 shrink-0"
          />
          <span className="text-sm text-gray-600">
            <span className="text-red-600">*</span> Akceptuję przetwarzanie moich danych osobowych w celu realizacji zapytania ofertowego zgodnie z RODO.
          </span>
        </label>
      </div>
    </div>
  );
}

// ── Step 6: Zdjęcia ───────────────────────────────────────────────────────────

function Step6({
  photos, setPhotos, fileRef, addPhotos, newPhotoCategory, setNewPhotoCategory, serviceType,
}: {
  photos: PhotoFile[];
  setPhotos: (p: PhotoFile[]) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  addPhotos: (files: FileList) => void;
  newPhotoCategory: string;
  setNewPhotoCategory: (v: string) => void;
  serviceType: string;
}) {
  const hint = PHOTO_CATEGORIES.find(c => c.value === newPhotoCategory)?.hint ?? "";

  const relevantCategories = serviceType === "CCTV"
    ? ["ELEWACJA", "KAMERA", "REJESTRATOR", "TRASY", "ROZDZIELNIA"]
    : serviceType === "ALARM"
    ? ["ELEWACJA", "CZUJKA", "CENTRALA", "ROZDZIELNIA"]
    : serviceType === "BRAMA"
    ? ["BRAMA", "ELEWACJA", "ROZDZIELNIA"]
    : serviceType === "DOMOFON"
    ? ["ELEWACJA", "BRAMA", "TRASY"]
    : serviceType === "SIEC"
    ? ["TRASY", "REJESTRATOR", "ROZDZIELNIA"]
    : PHOTO_CATEGORIES.map(c => c.value);

  const filteredCategories = PHOTO_CATEGORIES.filter(c =>
    relevantCategories.includes(c.value) || c.value === "INNE"
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Zdjęcia (opcjonalne, ale bardzo pomocne)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Zdjęcia pozwalają nam dokładniej wycenić i zaplanować montaż
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        💡 <strong>Wskazówka:</strong> Zrób zdjęcia miejsca, gdzie ma być zamontowany sprzęt. Im więcej zdjęć, tym dokładniejsza wycena.
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Kategoria nowego zdjęcia</Label>
        <div className="flex flex-wrap gap-1.5">
          {filteredCategories.map((c) => (
            <button
              key={c.value}
              onClick={() => setNewPhotoCategory(c.value)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-full border transition-colors",
                newPhotoCategory === c.value
                  ? "border-red-800 bg-red-50 text-red-900"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {hint && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{hint}</p>
        )}
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-red-300 transition-colors"
      >
        <Camera className="w-8 h-8 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">Dodaj zdjęcia</span>
        <span className="text-xs text-gray-400">Kliknij lub przeciągnij pliki</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addPhotos(e.target.files)}
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200">
              <img src={p.preview} alt="" className="w-full aspect-square object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <p className="text-xs text-white truncate">
                  {PHOTO_CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}
                </p>
              </div>
              <button
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 7: Podsumowanie ──────────────────────────────────────────────────────

function Step7({ form, photos }: { form: FormData; photos: PhotoFile[] }) {
  const serviceLabel = SERVICE_TYPES.find(t => t.value === form.serviceType)?.label ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Sprawdź i wyślij</h2>
        <p className="text-sm text-gray-500 mt-1">Przejrzyj swoje zapytanie przed wysłaniem</p>
      </div>

      <div className="space-y-3">
        <SummaryRow label="Usługa" value={serviceLabel} />
        <SummaryRow label="Imię i nazwisko" value={form.contactName} />
        <SummaryRow label="Telefon" value={form.contactPhone} />
        {form.contactEmail && <SummaryRow label="Email" value={form.contactEmail} />}
        {form.investmentCity && <SummaryRow label="Miejscowość" value={form.investmentCity} />}
        {form.objectType && <SummaryRow label="Typ obiektu" value={form.objectType} />}
        {form.expectedDate && <SummaryRow label="Termin" value={form.expectedDate} />}
        {photos.length > 0 && <SummaryRow label="Zdjęcia" value={`${photos.length} zdjęcie(a)`} />}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        <p className="font-medium mb-1">✓ Co dalej?</p>
        <p>Po wysłaniu zapytania skontaktujemy się z Tobą telefonicznie lub mailowo w celu omówienia szczegółów i przygotowania indywidualnej wyceny.</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ── Success page ──────────────────────────────────────────────────────────────

function SuccessPage({ token, number }: { token: string; number: string }) {
  const returnUrl = `${window.location.origin}/quote/inquiry/${token}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">All-Secure</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zapytanie wysłane!</h1>
            <p className="text-gray-500 mt-2">Dziękujemy za kontakt. Skontaktujemy się z Tobą wkrótce.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs text-gray-500">Numer zapytania</p>
            <p className="font-mono font-bold text-lg text-gray-900">{number}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 text-left space-y-2">
            <p className="font-medium">💡 Chcesz uzupełnić zdjęcia lub dane?</p>
            <p>Zachowaj ten link — możesz wrócić do zapytania w dowolnym momencie:</p>
            <div className="bg-white rounded-lg px-3 py-2 font-mono text-xs break-all border border-blue-200">
              {returnUrl}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(returnUrl).then(() => alert("Skopiowano!"))}
              className="w-full text-center py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-900 text-xs font-medium transition-colors"
            >
              Kopiuj link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
