"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";

interface StockItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  notes: string | null;
  category: { name: string } | null;
}

export default function StockPage() {
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (search) params.set("q", search);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-items", search],
    queryFn: async () => {
      const r = await fetch(`/api/stock/items?${params}`);
      return r.json();
    },
  });

  const items: StockItem[] = data?.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Magazyn</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} pozycji</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Szukaj po nazwie lub SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak pozycji magazynowych</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">Nazwa</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden sm:table-cell">Kategoria</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">SKU</th>
                <th className="text-left p-3 font-medium text-gray-600">Jedn.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                  </td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">
                    {item.category?.name ?? "—"}
                  </td>
                  <td className="p-3 text-gray-400 font-mono text-xs hidden md:table-cell">
                    {item.sku ?? "—"}
                  </td>
                  <td className="p-3 text-gray-600">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
