"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceEntry {
  id: string;
  date: string;
  mileage: number | null;
  description: string;
  addedBy: string | null;
}

interface Vehicle {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string;
  vin: string | null;
  insuranceNumber: string | null;
  insuranceExpiry: string | null;
  inspectionExpiry: string | null;
  notes: string | null;
  serviceEntries: ServiceEntry[];
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const r = await fetch(`/api/vehicles/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const vehicle: Vehicle | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Nie znaleziono pojazdu</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/vehicles")}>
          Powrót
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/vehicles")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-sm font-mono text-blue-600">{vehicle.plate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Car className="h-4 w-4" />
            Dane pojazdu
          </h2>
          {[
            ["Rok produkcji", vehicle.year],
            ["VIN", vehicle.vin],
          ].map(([label, value]) =>
            value ? (
              <div key={String(label)} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ) : null
          )}
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold text-gray-700">Dokumenty</h2>
          {[
            ["Nr polisy OC", vehicle.insuranceNumber],
            ["Ważność OC", vehicle.insuranceExpiry ? format(new Date(vehicle.insuranceExpiry), "d MMMM yyyy", { locale: pl }) : null],
            ["Przegląd do", vehicle.inspectionExpiry ? format(new Date(vehicle.inspectionExpiry), "d MMMM yyyy", { locale: pl }) : null],
          ].map(([label, value]) =>
            value ? (
              <div key={String(label)} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {vehicle.notes && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h2 className="font-semibold text-gray-700 mb-2">Notatki</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{vehicle.notes}</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-800 mb-3">
          Historia serwisowa ({vehicle.serviceEntries.length})
        </h2>
        {vehicle.serviceEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border rounded-xl bg-white">
            <p className="text-sm">Brak wpisów serwisowych</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vehicle.serviceEntries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg border p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{entry.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 ml-3 shrink-0">
                    <p>{format(new Date(entry.date), "d MMM yyyy", { locale: pl })}</p>
                    {entry.mileage && <p>{entry.mileage.toLocaleString()} km</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
