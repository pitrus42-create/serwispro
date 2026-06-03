"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ITEM_TYPES = [
  { value: "SPRZET",       label: "Sprzęt" },
  { value: "ROBOCIZNA",    label: "Robocizna" },
  { value: "KONFIGURACJA", label: "Konfiguracja" },
  { value: "MATERIALY",    label: "Materiały" },
  { value: "INNE",         label: "Inne" },
];

const TYPE_COLORS: Record<string, string> = {
  SPRZET: "bg-blue-100 text-blue-800",
  ROBOCIZNA: "bg-green-100 text-green-800",
  KONFIGURACJA: "bg-purple-100 text-purple-800",
  MATERIALY: "bg-amber-100 text-amber-800",
  INNE: "bg-gray-100 text-gray-700",
};

interface CatalogItem {
  id: string; name: string; description: string | null; itemType: string;
  unit: string; defaultNetPrice: number; vatRate: number; modelName: string | null;
}

const emptyForm = { name: "", description: "", itemType: "SPRZET", unit: "szt", defaultNetPrice: "0", vatRate: "23", modelName: "" };

export default function ProductCatalogPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["product-catalog", q],
    queryFn: async () => {
      const res = await fetch(`/api/product-catalog?q=${encodeURIComponent(q)}`);
      return res.json() as Promise<CatalogItem[]>;
    },
  });

  const save = async () => {
    const url = editId ? `/api/product-catalog/${editId}` : "/api/product-catalog";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { toast.error("Błąd zapisu"); return; }
    toast.success(editId ? "Zaktualizowano" : "Dodano do katalogu");
    qc.invalidateQueries({ queryKey: ["product-catalog"] });
    setAdding(false); setEditId(null); setForm(emptyForm);
  };

  const remove = async (id: string) => {
    await fetch(`/api/product-catalog/${id}`, { method: "DELETE" });
    toast.success("Usunięto z katalogu");
    qc.invalidateQueries({ queryKey: ["product-catalog"] });
  };

  const startEdit = (item: CatalogItem) => {
    setForm({ name: item.name, description: item.description ?? "", itemType: item.itemType, unit: item.unit, defaultNetPrice: String(item.defaultNetPrice), vatRate: String(item.vatRate), modelName: item.modelName ?? "" });
    setEditId(item.id); setAdding(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Katalog produktów i usług</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gotowe pozycje do wstawiania do wycen</p>
        </div>
        <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm); }}>
          <Plus className="w-4 h-4 mr-1" /> Dodaj
        </Button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm text-gray-900">{editId ? "Edytuj pozycję" : "Nowa pozycja"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Nazwa *</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} className="text-sm" placeholder="np. Kamera IP 4Mpx outdoor" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model / symbol</Label>
              <Input value={form.modelName} onChange={(e) => setForm(p => ({...p, modelName: e.target.value}))} className="text-sm" placeholder="np. Dahua IPC-HDW2849H" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ</Label>
              <Select value={form.itemType} onValueChange={(v) => setForm(p => ({...p, itemType: v}))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cena netto (zł)</Label>
              <Input type="number" value={form.defaultNetPrice} onChange={(e) => setForm(p => ({...p, defaultNetPrice: e.target.value}))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">VAT / jednostka</Label>
              <div className="flex gap-2">
                <Select value={form.vatRate} onValueChange={(v) => setForm(p => ({...p, vatRate: v}))}>
                  <SelectTrigger className="h-9 text-sm w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0,8,23].map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
                <Input value={form.unit} onChange={(e) => setForm(p => ({...p, unit: e.target.value}))} className="text-sm" placeholder="szt" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="bg-red-800 hover:bg-red-900 text-white"><Save className="w-3 h-3 mr-1" />Zapisz</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setEditId(null); }}><X className="w-3 h-3 mr-1" />Anuluj</Button>
          </div>
        </div>
      )}

      <Input placeholder="Szukaj w katalogu..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Brak pozycji w katalogu</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  {item.modelName && <span className="text-xs text-gray-400 italic">{item.modelName}</span>}
                  <Badge className={`text-xs ${TYPE_COLORS[item.itemType] ?? "bg-gray-100"}`}>{ITEM_TYPES.find(t => t.value === item.itemType)?.label}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{item.defaultNetPrice.toFixed(2)} zł netto + {item.vatRate}% VAT · {item.unit}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(item)} className="text-gray-400 hover:text-gray-700 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
