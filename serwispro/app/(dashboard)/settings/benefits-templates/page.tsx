"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Bookmark, Trash2, Pencil, Star, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { SERVICE_TYPES, PACKAGE_TYPES, CLIENT_TYPES } from "@/lib/benefits-constants";

interface BenefitsTemplate {
  id: string;
  name: string;
  title: string;
  points: string;
  serviceType: string | null;
  packageType: string | null;
  clientType: string | null;
  isDefault: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "", title: "", points: [""] as string[],
  serviceType: "", packageType: "", clientType: "", isDefault: false,
};

export default function BenefitsTemplatesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterSvc, setFilterSvc] = useState("");
  const [filterPkg, setFilterPkg] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const { data: templates = [], isLoading } = useQuery<BenefitsTemplate[]>({
    queryKey: ["benefits-templates"],
    queryFn: async () => {
      const r = await fetch("/api/benefits-templates");
      return r.json();
    },
  });

  const filtered = useMemo(() => templates.filter(t => {
    if (filterSvc && t.serviceType !== filterSvc) return false;
    if (filterPkg && t.packageType !== filterPkg) return false;
    if (filterClient && t.clientType !== filterClient) return false;
    return true;
  }), [templates, filterSvc, filterPkg, filterClient]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, points: [""] });
    setDialogOpen(true);
  };

  const openEdit = (tpl: BenefitsTemplate) => {
    setEditingId(tpl.id);
    let pts: string[] = [""];
    try { pts = JSON.parse(tpl.points); } catch { /* */ }
    setForm({
      name: tpl.name,
      title: tpl.title,
      points: pts.length > 0 ? pts : [""],
      serviceType: tpl.serviceType ?? "",
      packageType: tpl.packageType ?? "",
      clientType: tpl.clientType ?? "",
      isDefault: tpl.isDefault,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Podaj nazwę szablonu"); return; }
    if (!form.title.trim()) { toast.error("Podaj tytuł korzyści"); return; }
    const pts = form.points.filter(p => p.trim());
    if (pts.length === 0) { toast.error("Dodaj co najmniej jeden punkt"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name, title: form.title, points: pts,
        serviceType: form.serviceType || null,
        packageType: form.packageType || null,
        clientType: form.clientType || null,
        isDefault: form.isDefault,
      };
      const url = editingId ? `/api/benefits-templates/${editingId}` : "/api/benefits-templates";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); toast.error(e.error ?? "Błąd"); return; }
      toast.success(editingId ? "Szablon zaktualizowany" : "Szablon utworzony");
      qc.invalidateQueries({ queryKey: ["benefits-templates"] });
      setDialogOpen(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await fetch(`/api/benefits-templates/${id}`, { method: "DELETE" });
    toast.success("Szablon usunięty");
    qc.invalidateQueries({ queryKey: ["benefits-templates"] });
  };

  const toggleDefault = async (tpl: BenefitsTemplate) => {
    let pts: string[] = [];
    try { pts = JSON.parse(tpl.points); } catch { /* */ }
    await fetch(`/api/benefits-templates/${tpl.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tpl, points: pts, isDefault: !tpl.isDefault }),
    });
    qc.invalidateQueries({ queryKey: ["benefits-templates"] });
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/benefits-templates/seed-defaults", { method: "POST" });
      const { created, skipped } = await res.json();
      toast.success(`Dodano ${created} szablonów${skipped > 0 ? `, pominięto ${skipped} (już istnieją)` : ""}`);
      qc.invalidateQueries({ queryKey: ["benefits-templates"] });
    } finally { setSeeding(false); }
  };

  const addPoint = () => setForm(p => ({ ...p, points: [...p.points, ""] }));
  const removePoint = (idx: number) => setForm(p => ({ ...p, points: p.points.filter((_, i) => i !== idx) }));
  const updatePoint = (idx: number, val: string) => setForm(p => { const pts = [...p.points]; pts[idx] = val; return { ...p, points: pts }; });

  const hasFilters = filterSvc || filterPkg || filterClient;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Szablony korzyści</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gotowe zestawy korzyści pakietów do wstawiania w wycenach</p>
        </div>
        <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nowy szablon
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterSvc} onValueChange={setFilterSvc}>
          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Typ usługi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">Wszystkie usługi</SelectItem>
            {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPkg} onValueChange={setFilterPkg}>
          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Typ pakietu" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">Wszystkie pakiety</SelectItem>
            {PACKAGE_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Typ klienta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">Wszyscy klienci</SelectItem>
            {CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button onClick={() => { setFilterSvc(""); setFilterPkg(""); setFilterClient(""); }} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5">
            <X className="w-3 h-3" /> Wyczyść
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <Bookmark className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">Brak szablonów korzyści</p>
          <Button size="sm" variant="outline" onClick={seedDefaults} disabled={seeding}>
            {seeding ? "Inicjowanie..." : "Zainicjuj domyślne szablony"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {!isLoading && templates.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Brak szablonów pasujących do filtrów</p>
          )}
          {filtered.map(tpl => {
            let pts: string[] = [];
            try { pts = JSON.parse(tpl.points); } catch { /* */ }
            const expanded = expandedId === tpl.id;
            return (
              <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden group hover:border-red-200 transition-colors">
                <div className="px-4 py-3 flex items-start justify-between gap-2">
                  <button className="flex-1 text-left min-w-0" onClick={() => setExpandedId(expanded ? null : tpl.id)}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-900 text-sm">{tpl.name}</span>
                      {tpl.isDefault && <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-300 px-1 py-0">Domyślny</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tpl.serviceType && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{SERVICE_TYPES.find(s => s.value === tpl.serviceType)?.label ?? tpl.serviceType}</span>}
                      {tpl.packageType && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{PACKAGE_TYPES.find(s => s.value === tpl.packageType)?.label ?? tpl.packageType}</span>}
                      {tpl.clientType && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{CLIENT_TYPES.find(s => s.value === tpl.clientType)?.label ?? tpl.clientType}</span>}
                      <span className="text-[10px] text-gray-400">{pts.length} pkt.</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => toggleDefault(tpl)} title={tpl.isDefault ? "Odznacz domyślny" : "Ustaw jako domyślny"} className={`p-1 ${tpl.isDefault ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}>
                      <Star className="w-3.5 h-3.5" fill={tpl.isDefault ? "currentColor" : "none"} />
                    </button>
                    <button onClick={() => openEdit(tpl)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(tpl.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : tpl.id)} className="p-1 text-gray-400">
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1">
                    <p className="text-xs text-gray-600 font-medium">{tpl.title}</p>
                    <ul className="space-y-0.5">
                      {pts.map((pt, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edytuj szablon" : "Nowy szablon korzyści"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Nazwa szablonu *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="np. Standard CCTV — klient premium" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Typ usługi</Label>
                <Select value={form.serviceType} onValueChange={v => setForm(p => ({ ...p, serviceType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dowolny" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">Dowolny</SelectItem>
                    {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ pakietu</Label>
                <Select value={form.packageType} onValueChange={v => setForm(p => ({ ...p, packageType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dowolny" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">Dowolny</SelectItem>
                    {PACKAGE_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typ klienta</Label>
                <Select value={form.clientType} onValueChange={v => setForm(p => ({ ...p, clientType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dowolny" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">Dowolny</SelectItem>
                    {CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tytuł korzyści *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="np. Rekomendowany wariant — najlepszy balans..." className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Punkty *</Label>
              <div className="space-y-1">
                {form.points.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-green-600 text-xs flex-shrink-0">✓</span>
                    <Input
                      value={pt}
                      onChange={e => updatePoint(idx, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPoint(); } }}
                      placeholder="Punkt korzyści..."
                      className="h-7 text-xs flex-1"
                    />
                    <button onClick={() => removePoint(idx)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addPoint} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5 mt-1">
                <Plus className="w-3 h-3" /> Dodaj punkt
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="isDefault"
                checked={form.isDefault}
                onCheckedChange={v => setForm(p => ({ ...p, isDefault: !!v }))}
              />
              <Label htmlFor="isDefault" className="text-xs cursor-pointer">Oznacz jako szablon domyślny</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Anuluj</Button>
            <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Utwórz szablon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
