"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Search, Building2, User, ChevronRight, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  alias: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  _count: { orders: number; locations: number };
}

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("q", search);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", { search, page }],
    queryFn: async () => {
      const r = await fetch(`/api/clients?${params}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const clients: Client[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klienci</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} klientów</p>
        </div>
        <Button onClick={() => router.push("/clients/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nowy klient</span>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Szukaj po nazwie, telefonie, NIP..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak klientów</p>
          <p className="text-sm mt-1">Dodaj pierwszego klienta klikając przycisk powyżej</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => router.push(`/clients/${client.id}`)}
              className="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                {client.type === "OSOBA_PRYWATNA" ? (
                  <User className="h-5 w-5 text-red-800" />
                ) : (
                  <Building2 className="h-5 w-5 text-red-800" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{client.name}</p>
                  {client.alias && (
                    <span className="text-xs text-gray-400">({client.alias})</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-sm text-gray-500">
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {client.email}
                    </span>
                  )}
                  {(client.address || client.city) && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <MapPin className="h-3 w-3" />
                      {[client.address, client.postalCode, client.city].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-400">{client._count.locations} lok.</p>
                  <p className="text-xs text-gray-400">{client._count.orders} zlec.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Poprzednia
          </Button>
          <span className="flex items-center text-sm text-gray-600 px-3">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Następna
          </Button>
        </div>
      )}
    </div>
  );
}
