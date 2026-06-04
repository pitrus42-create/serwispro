"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SERVICE_TYPES = [
  { value: "CCTV", label: "Montaż systemu CCTV" },
  { value: "ALARM", label: "Montaż alarmu" },
  { value: "BRAMA", label: "Automatyka bramowa" },
  { value: "DOMOFON", label: "Domofon / wideodomofon" },
  { value: "SIEC", label: "Sieć LAN / Wi-Fi / szafa rack" },
  { value: "AWARIA", label: "Awaria systemu" },
  { value: "KONSERWACJA", label: "Konserwacja systemu" },
  { value: "MODERNIZACJA", label: "Modernizacja systemu" },
  { value: "INNE", label: "Inne" },
];

const SOURCES = [
  { value: "TELEFON", label: "Telefon" },
  { value: "EMAIL", label: "Email" },
  { value: "FORMULARZ", label: "Formularz www" },
  { value: "POLECENIE", label: "Polecenie" },
  { value: "RECZNE", label: "Ręczne wprowadzenie" },
  { value: "INNE", label: "Inne" },
];

const PRIORITIES = [
  { value: "NAJNIZSZA_CENA", label: "Najniższa cena" },
  { value: "CENA_JAKOSC", label: "Najlepszy stosunek ceny do jakości" },
  { value: "ESTETYKA", label: "Estetyka montażu" },
  { value: "NIEZAWODNOSC", label: "Niezawodność" },
  { value: "SPRZET", label: "Profesjonalny sprzęt" },
  { value: "ROZBUDOWA", label: "Możliwość rozbudowy w przyszłości" },
];

export default function NewInquiryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    serviceType: "",
    source: "RECZNE",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    companyName: "",
    nip: "",
    investmentAddress: "",
    investmentCity: "",
    investmentPostal: "",
    expectedDate: "",
    budgetRange: "",
    internalNotes: "",
    aestheticsScale: 5,
    priorities: [] as string[],
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const togglePriority = (val: string) => {
    setForm((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(val)
        ? prev.priorities.filter((p) => p !== val)
        : [...prev.priorities, val],
    }));
  };

  const handleSubmit = async () => {
    if (!form.serviceType) {
      toast.error("Wybierz typ usługi");
      return;
    }
    if (!form.contactName.trim()) {
      toast.error("Podaj imię i nazwisko osoby kontaktowej");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const inquiry = await res.json();
      toast.success(`Zapytanie ${inquiry.inquiryNumber} zostało utworzone`);
      router.push(`/inquiries/${inquiry.id}`);
    } catch {
      toast.error("Nie udało się zapisać zapytania");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Wróć
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nowe zapytanie ofertowe</h1>
          <p className="text-sm text-gray-500">Ręczne wprowadzenie zapytania</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Typ usługi */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="font-medium text-gray-900">Typ usługi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("serviceType", t.value)}
                className={cn(
                  "text-sm p-2.5 rounded-lg border text-left transition-colors",
                  form.serviceType === t.value
                    ? "border-red-800 bg-red-50 text-red-900 font-medium"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Źródło zapytania */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="font-medium text-gray-900">Źródło zapytania</h2>
          <Select value={form.source} onValueChange={(v) => set("source", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Dane kontaktowe */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="font-medium text-gray-900">Dane kontaktowe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Imię i nazwisko *</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Telefon</Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                placeholder="+48 600 000 000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                placeholder="jan@firma.pl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Firma (opcjonalnie)</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Nazwa firmy"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nip">NIP (opcjonalnie)</Label>
              <Input
                id="nip"
                value={form.nip}
                onChange={(e) => set("nip", e.target.value)}
                placeholder="000-000-00-00"
              />
            </div>
          </div>
        </section>

        {/* Adres inwestycji */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="font-medium text-gray-900">Adres inwestycji</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="investmentAddress">Ulica i numer</Label>
              <Input
                id="investmentAddress"
                value={form.investmentAddress}
                onChange={(e) => set("investmentAddress", e.target.value)}
                placeholder="ul. Przykładowa 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="investmentCity">Miasto</Label>
              <Input
                id="investmentCity"
                value={form.investmentCity}
                onChange={(e) => set("investmentCity", e.target.value)}
                placeholder="Warszawa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="investmentPostal">Kod pocztowy</Label>
              <Input
                id="investmentPostal"
                value={form.investmentPostal}
                onChange={(e) => set("investmentPostal", e.target.value)}
                placeholder="00-000"
              />
            </div>
          </div>
        </section>

        {/* Preferencje */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="font-medium text-gray-900">Preferencje klienta</h2>

          <div className="space-y-2">
            <Label>
              Skala estetyki montażu:{" "}
              <span className="font-semibold text-red-800">{form.aestheticsScale}/10</span>
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
              <span>1 — budżetowy</span>
              <span>5 — kompromis</span>
              <span>10 — premium</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Priorytety (można wybrać kilka)</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePriority(p.value)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-colors",
                    form.priorities.includes(p.value)
                      ? "border-red-800 bg-red-50 text-red-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Dodatkowe */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="font-medium text-gray-900">Dodatkowe informacje</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expectedDate">Oczekiwany termin realizacji</Label>
              <Input
                id="expectedDate"
                value={form.expectedDate}
                onChange={(e) => set("expectedDate", e.target.value)}
                placeholder="np. do końca września, ASAP"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budgetRange">Budżet orientacyjny</Label>
              <Input
                id="budgetRange"
                value={form.budgetRange}
                onChange={(e) => set("budgetRange", e.target.value)}
                placeholder="np. 3000–5000 zł"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="internalNotes">Notatki wewnętrzne</Label>
            <Textarea
              id="internalNotes"
              value={form.internalNotes}
              onChange={(e) => set("internalNotes", e.target.value)}
              placeholder="Informacje widoczne tylko dla pracowników..."
              rows={3}
            />
          </div>
        </section>

        <Button
          className="w-full bg-red-800 hover:bg-red-900 text-white"
          size="lg"
          onClick={handleSubmit}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Zapisywanie..." : "Utwórz zapytanie"}
        </Button>
      </div>
    </div>
  );
}
