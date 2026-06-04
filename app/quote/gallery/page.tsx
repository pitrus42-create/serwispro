"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Grid3X3, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_FILTERS = [
  { value: "",            label: "Wszystkie" },
  { value: "CCTV",       label: "Monitoring CCTV" },
  { value: "ALARM",      label: "Alarmy" },
  { value: "BRAMA",      label: "Automatyka bramowa" },
  { value: "DOMOFON",    label: "Domofony" },
  { value: "SIEC",       label: "Sieć LAN / Wi-Fi" },
  { value: "INNE",       label: "Inne" },
];

interface GalleryPhoto {
  id: string;
  fileUrl: string;
  fileName: string | null;
  caption: string | null;
  isMain: boolean;
}

interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  category: string | null;
  photos: GalleryPhoto[];
}

const SERVICE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV", ALARM: "Alarm", BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon", SIEC: "Sieć LAN/Wi-Fi", INNE: "Inne",
};

export default function PublicGalleryPage() {
  const [filter, setFilter] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; caption: string | null } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-gallery", filter],
    queryFn: async () => {
      const url = `/api/public/gallery${filter ? `?serviceType=${filter}` : ""}`;
      const res = await fetch(url);
      return res.json() as Promise<GalleryItem[]>;
    },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/quote/inquiry" className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Nasze realizacje</h1>
              <p className="text-xs text-gray-500">Przykłady wykonanych instalacji All-Secure</p>
            </div>
          </div>
          <a
            href="/quote/inquiry"
            className="text-sm font-medium text-white bg-red-800 hover:bg-red-900 px-4 py-2 rounded-lg transition-colors"
          >
            Zapytaj o wycenę →
          </a>
        </div>

        {/* Filtry kategorii */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {SERVICE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors",
                filter === f.value
                  ? "bg-red-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Grid3X3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Brak realizacji w tej kategorii</p>
          </div>
        ) : (
          <div className="space-y-8">
            {items.map((item) => (
              <div key={item.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{item.title}</h2>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  {item.serviceType && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full shrink-0 ml-3">
                      {SERVICE_LABELS[item.serviceType] ?? item.serviceType}
                    </span>
                  )}
                </div>

                {item.photos.length > 0 && (
                  <div className={cn(
                    "grid gap-2",
                    item.photos.length === 1 ? "grid-cols-1 max-w-sm" :
                    item.photos.length === 2 ? "grid-cols-2" :
                    "grid-cols-2 sm:grid-cols-3"
                  )}>
                    {item.photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setLightbox({ url: photo.fileUrl, caption: photo.caption })}
                        className={cn(
                          "relative overflow-hidden rounded-xl bg-gray-100 group",
                          item.photos.length === 1 ? "aspect-video" : "aspect-square"
                        )}
                      >
                        <img
                          src={photo.fileUrl}
                          alt={photo.caption ?? item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {photo.isMain && (
                          <span className="absolute top-2 left-2 text-[10px] bg-red-800 text-white px-1.5 py-0.5 rounded font-medium">
                            Główne
                          </span>
                        )}
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs">{photo.caption}</p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <Layers className="w-8 h-8 text-red-800 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 mb-1">Chcesz podobną instalację?</h3>
          <p className="text-sm text-gray-600 mb-4">
            Wypełnij formularz zapytania — przygotujemy bezpłatną wycenę dopasowaną do Twoich potrzeb.
          </p>
          <a
            href="/quote/inquiry"
            className="inline-block bg-red-800 hover:bg-red-900 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Zapytaj o wycenę
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            ×
          </button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? ""}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {lightbox.caption && (
              <p className="text-white text-sm text-center mt-2 opacity-80">{lightbox.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
