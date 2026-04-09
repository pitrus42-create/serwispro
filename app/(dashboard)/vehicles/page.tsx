"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Car, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string;
  insuranceExpiry: string | null;
  inspectionExpiry: string | null;
  notes: string | null;
}

export default function VehiclesPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const r = await fetch("/api/vehicles");
      return r.json();
    },
  });

  const vehicles: Vehicle[] = data?.data ?? [];
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    return d <= soon && d >= now;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < now;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pojazdy</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak pojazdów</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const insExpiring = isExpiringSoon(v.insuranceExpiry);
            const insExpired = isExpired(v.insuranceExpiry);
            const inspExpiring = isExpiringSoon(v.inspectionExpiry);
            const inspExpired = isExpired(v.inspectionExpiry);
            const hasAlert = insExpired || insExpiring || inspExpired || inspExpiring;

            return (
              <div
                key={v.id}
                onClick={() => router.push(`/vehicles/${v.id}`)}
                className={cn(
                  "bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow",
                  hasAlert && "border-amber-300"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Car className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">
                        {v.brand} {v.model} {v.year ? `(${v.year})` : ""}
                      </h2>
                      {hasAlert && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm font-mono text-blue-600 mt-0.5">{v.plate}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      {v.insuranceExpiry && (
                        <span className={cn(
                          "flex items-center gap-1",
                          insExpired ? "text-red-600 font-semibold" : insExpiring ? "text-amber-600" : "text-gray-500"
                        )}>
                          OC: {format(new Date(v.insuranceExpiry), "d MMM yyyy", { locale: pl })}
                          {insExpired && " (wygasło!)"}
                          {insExpiring && " (wkrótce)"}
                        </span>
                      )}
                      {v.inspectionExpiry && (
                        <span className={cn(
                          "flex items-center gap-1",
                          inspExpired ? "text-red-600 font-semibold" : inspExpiring ? "text-amber-600" : "text-gray-500"
                        )}>
                          Przegląd: {format(new Date(v.inspectionExpiry), "d MMM yyyy", { locale: pl })}
                          {inspExpired && " (wygasł!)"}
                          {inspExpiring && " (wkrótce)"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
