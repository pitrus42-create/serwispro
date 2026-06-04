"use client";

import { useState, useRef, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import {
  Camera, X, Check, Shield, MessageSquare, Send, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NOWE: "Nowe — oczekuje na analizę",
  W_ANALIZIE: "W analizie",
  BRAKUJE_INFO: "Prosimy o dodatkowe informacje",
  GOTOWE_DO_WYCENY: "Gotowe do wyceny",
  WYCENA_PRZYGOTOWANA: "Wycena przygotowana",
  WYCENA_WYSLANA: "Wycena wysłana",
  OCZEKUJE_NA_DECYZJE: "Oczekuje na Twoją decyzję",
  ZAAKCEPTOWANE: "Zaakceptowane",
  ODRZUCONE: "Odrzucone",
  PRZEKSZTALCONE: "W realizacji",
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
  KONSERWACJA: "Konserwacja",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

const PHOTO_CATEGORIES = [
  { value: "ELEWACJA",    label: "Elewacja budynku" },
  { value: "KAMERA",      label: "Miejsce kamery" },
  { value: "CZUJKA",      label: "Miejsce czujki" },
  { value: "CENTRALA",    label: "Centrala alarmowa" },
  { value: "REJESTRATOR", label: "Rejestrator / rack" },
  { value: "TRASY",       label: "Trasy kablowe" },
  { value: "ROZDZIELNIA", label: "Rozdzielnia el." },
  { value: "BRAMA",       label: "Brama / furtka" },
  { value: "PLAN",        label: "Plan budynku" },
  { value: "INNE",        label: "Inne" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicInquiry {
  id: string;
  inquiryNumber: string;
  status: string;
  serviceType: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  investmentAddress: string | null;
  investmentCity: string | null;
  createdAt: string;
  photos: { id: string; fileUrl: string; category: string | null; description: string | null; addedAt: string }[];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InquiryReturnPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("INNE");
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [commentExpanded, setCommentExpanded] = useState(true);

  const { data: inquiry, isLoading, error } = useQuery({
    queryKey: ["public-inquiry", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/inquiry/${token}`);
      if (!res.ok) throw new Error("Nie znaleziono");
      return res.json() as Promise<PublicInquiry>;
    },
  });

  const uploadPhotos = async (files: FileList) => {
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("photos", f));
      fd.append("category", category);
      const res = await fetch(`/api/public/inquiry/${token}/photos`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();
      toast.success("Zdjęcia dodane — dziękujemy!");
      qc.invalidateQueries({ queryKey: ["public-inquiry", token] });
    } catch {
      toast.error("Nie udało się dodać zdjęć");
    } finally {
      setUploading(false);
    }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/public/inquiry/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentText }),
      });
      if (!res.ok) throw new Error();
      toast.success("Komentarz wysłany!");
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["public-inquiry", token] });
    } catch {
      toast.error("Nie udało się wysłać komentarza");
    } finally {
      setSendingComment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-red-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Ładowanie zapytania...</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">🔍</div>
          <h1 className="font-bold text-gray-900">Nie znaleziono zapytania</h1>
          <p className="text-sm text-gray-500">Link jest nieprawidłowy lub zapytanie zostało usunięte.</p>
          <Button variant="outline" onClick={() => window.location.href = "/quote/inquiry"}>
            Złóż nowe zapytanie
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-none">All-Secure</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">Twoje zapytanie {inquiry.inquiryNumber}</p>
          </div>
          <Badge className={cn("text-xs shrink-0", STATUS_COLORS[inquiry.status] ?? "bg-gray-100")}>
            {STATUS_LABELS[inquiry.status] ?? inquiry.status}
          </Badge>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {/* Status info */}
        {inquiry.status === "BRAKUJE_INFO" && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
            <p className="font-medium mb-1">⚠️ Potrzebujemy więcej informacji</p>
            <p>Prosimy o uzupełnienie zdjęć lub dodanie komentarza z brakującymi danymi poniżej.</p>
          </div>
        )}

        {/* Podsumowanie zapytania */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm">Twoje zapytanie</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Usługa</span>
              <span className="font-medium">{SERVICE_TYPE_LABELS[inquiry.serviceType] ?? inquiry.serviceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Osoba</span>
              <span className="font-medium">{inquiry.contactName}</span>
            </div>
            {inquiry.contactPhone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Telefon</span>
                <span className="font-medium">{inquiry.contactPhone}</span>
              </div>
            )}
            {inquiry.investmentCity && (
              <div className="flex justify-between">
                <span className="text-gray-500">Miejscowość</span>
                <span className="font-medium">{inquiry.investmentCity}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Data złożenia</span>
              <span className="font-medium">
                {format(new Date(inquiry.createdAt), "d MMM yyyy", { locale: pl })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Zdjęcia</span>
              <span className="font-medium">{inquiry.photos.length}</span>
            </div>
          </div>
        </div>

        {/* Dodaj zdjęcia */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setPhotosExpanded(!photosExpanded)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 text-sm">Dodaj zdjęcia</span>
              {inquiry.photos.length > 0 && (
                <Badge variant="secondary" className="text-xs">{inquiry.photos.length}</Badge>
              )}
            </div>
            {photosExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {photosExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Kategoria zdjęcia</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHOTO_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-1.5 hover:border-red-200 transition-colors disabled:opacity-50"
              >
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-600">{uploading ? "Wysyłanie..." : "Wybierz zdjęcia z telefonu"}</span>
                <span className="text-xs text-gray-400">JPG, PNG — do 10 MB każde</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadPhotos(e.target.files)}
              />

              {inquiry.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {inquiry.photos.map((photo) => (
                    <div key={photo.id} className="relative rounded-lg overflow-hidden border border-gray-100 aspect-square">
                      <img src={photo.fileUrl} alt="" className="w-full h-full object-cover" />
                      {photo.category && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                          <p className="text-white text-xs truncate">
                            {PHOTO_CATEGORIES.find(c => c.value === photo.category)?.label ?? photo.category}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dodaj komentarz */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCommentExpanded(!commentExpanded)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900 text-sm">Dodaj komentarz lub informacje</span>
            </div>
            {commentExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {commentExpanded && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Dodatkowe informacje, pytania, uwagi..."
                rows={3}
                className="text-sm"
              />
              <Button
                size="sm"
                className="w-full bg-red-800 hover:bg-red-900 text-white"
                disabled={!commentText.trim() || sendingComment}
                onClick={sendComment}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {sendingComment ? "Wysyłanie..." : "Wyślij"}
              </Button>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-400 pb-4">
          <p>Numer zapytania: <span className="font-mono">{inquiry.inquiryNumber}</span></p>
          <p className="mt-1">W razie pytań zadzwoń lub napisz SMS</p>
        </div>
      </div>
    </div>
  );
}
