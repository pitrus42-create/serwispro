"use client";

import { useState, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ITEM_TYPES = [
  { value: "SPRZET", label: "Sprzęt" }, { value: "ROBOCIZNA", label: "Robocizna" },
  { value: "KONFIGURACJA", label: "Konfiguracja" }, { value: "MATERIALY", label: "Materiały" },
  { value: "INNE", label: "Inne" },
];

const PKG_COLORS: Record<string, string> = {
  MINIMUM: "border-gray-300", STANDARD: "border-blue-300", PRO: "border-amber-300",
};

interface TemplateItem { id: string; name: string; itemType: string; quantity: number; unit: string; netPrice: number; vatRate: number; modelName: string | null; }
interface TemplatePkg { id: string; packageType: string; name: string; description: string | null; includes: string | null; excludes: string | null; items: TemplateItem[]; }
interface Template { id: string; name: string; serviceType: string | null; conditions: string | null; packages: TemplatePkg[]; }

export default function QuoteTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: tpl, isLoading } = useQuery({
    queryKey: ["quote-template", id],
    queryFn: async () => {
      const res = await fetch(`/api/quote-templates/${id}`);
      return res.json() as Promise<Template>;
    },
  });

  const pkgOrder = ["MINIMUM", "STANDARD", "PRO"];

  if (isLoading) return <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  if (!tpl) return <div className="p-6 text-gray-500">Nie znaleziono szablonu</div>;

  const packages = pkgOrder.map(t => tpl.packages.find(p => p.packageType === t)).filter(Boolean) as TemplatePkg[];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/settings/quote-templates")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-semibold">{tpl.name}</h1>
        {tpl.serviceType && <Badge variant="outline">{tpl.serviceType}</Badge>}
      </div>

      <ConditionsSection template={tpl} onSave={() => qc.invalidateQueries({ queryKey: ["quote-template", id] })} />

      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Pakiety szablonu</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <PackageEditor key={pkg.id} pkg={pkg} templateId={id} onUpdate={() => qc.invalidateQueries({ queryKey: ["quote-template", id] })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConditionsSection({ template, onSave }: { template: Template; onSave: () => void }) {
  const [conditions, setConditions] = useState(template.conditions ?? "");
  const save = async () => {
    await fetch(`/api/quote-templates/${template.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditions }) });
    toast.success("Warunki zapisane"); onSave();
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Warunki realizacji (domyślne)</Label>
      <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className="text-sm" placeholder="Terminy płatności, gwarancja, zasady realizacji..." />
      <Button size="sm" onClick={save} className="bg-red-800 hover:bg-red-900 text-white"><Save className="w-3 h-3 mr-1" />Zapisz</Button>
    </div>
  );
}

function PackageEditor({ pkg, templateId, onUpdate }: { pkg: TemplatePkg; templateId: string; onUpdate: () => void }) {
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", itemType: "SPRZET", quantity: "1", unit: "szt", netPrice: "0", vatRate: "23", modelName: "" });

  const saveItem = async () => {
    if (!newItem.name) return;
    await fetch(`/api/quote-templates/${templateId}/packages/${pkg.id}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newItem, quantity: parseFloat(newItem.quantity), netPrice: parseFloat(newItem.netPrice), vatRate: parseFloat(newItem.vatRate) }),
    });
    toast.success("Dodano pozycję"); onUpdate();
    setAddingItem(false); setNewItem({ name: "", itemType: "SPRZET", quantity: "1", unit: "szt", netPrice: "0", vatRate: "23", modelName: "" });
  };

  const removeItem = async (itemId: string) => {
    await fetch(`/api/quote-templates/${templateId}/packages/${pkg.id}/items/${itemId}`, { method: "DELETE" });
    toast.success("Usunięto"); onUpdate();
  };

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${PKG_COLORS[pkg.packageType] ?? "border-gray-200"}`}>
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Badge variant="outline" className="text-xs mb-1">{pkg.packageType}</Badge>
        <p className="font-semibold text-sm text-gray-900">{pkg.name}</p>
        {pkg.description && <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>}
      </div>
      <div className="p-3 space-y-2">
        {pkg.items.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Brak pozycji</p>}
        {pkg.items.map(item => (
          <div key={item.id} className="flex items-start gap-2 group">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900">{item.name}</p>
              {item.modelName && <p className="text-xs text-gray-400 italic">{item.modelName}</p>}
              <p className="text-xs text-gray-400">{item.quantity} {item.unit} · {item.netPrice.toFixed(2)} zł netto</p>
            </div>
            <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-0.5"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}

        {addingItem ? (
          <div className="bg-white border border-blue-200 rounded-lg p-2 space-y-1.5 text-xs">
            <Input value={newItem.name} onChange={(e) => setNewItem(p => ({...p, name: e.target.value}))} placeholder="Nazwa pozycji" className="h-7 text-xs" />
            <Input value={newItem.modelName} onChange={(e) => setNewItem(p => ({...p, modelName: e.target.value}))} placeholder="Model (opcjonalnie)" className="h-7 text-xs" />
            <div className="grid grid-cols-2 gap-1">
              <Select value={newItem.itemType} onValueChange={(v) => setNewItem(p => ({...p, itemType: v}))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-1">
                <Input type="number" value={newItem.netPrice} onChange={(e) => setNewItem(p => ({...p, netPrice: e.target.value}))} placeholder="Cena" className="h-7 text-xs w-16" />
                <Input value={newItem.unit} onChange={(e) => setNewItem(p => ({...p, unit: e.target.value}))} placeholder="szt" className="h-7 text-xs" />
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs bg-red-800 hover:bg-red-900 text-white px-2" onClick={saveItem}><Check className="w-3 h-3 mr-1" />OK</Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddingItem(false)}>Anuluj</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingItem(true)} className="w-full text-xs text-gray-400 hover:text-red-800 border border-dashed border-gray-200 hover:border-red-300 rounded-lg py-1.5 flex items-center justify-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Dodaj pozycję
          </button>
        )}
      </div>
    </div>
  );
}
