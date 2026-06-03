"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, FileText, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const SERVICE_TYPES = [
  { value: "CCTV", label: "CCTV" }, { value: "ALARM", label: "Alarm" },
  { value: "BRAMA", label: "Brama" }, { value: "DOMOFON", label: "Domofon" },
  { value: "SIEC", label: "Sieć" }, { value: "AWARIA", label: "Awaria" },
  { value: "KONSERWACJA", label: "Konserwacja" }, { value: "MODERNIZACJA", label: "Modernizacja" },
];

interface QuoteTemplate {
  id: string; name: string; serviceType: string | null;
  packages: { packageType: string; items: unknown[] }[];
  createdAt: string;
}

export default function QuoteTemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", serviceType: "", description: "", conditions: "" });
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: async () => {
      const res = await fetch("/api/quote-templates");
      return res.json() as Promise<QuoteTemplate[]>;
    },
  });

  const create = async () => {
    if (!newForm.name) { toast.error("Podaj nazwę szablonu"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/quote-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newForm, serviceType: newForm.serviceType || null }),
      });
      const tpl = await res.json();
      toast.success("Szablon utworzony");
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
      setCreating(false);
      router.push(`/settings/quote-templates/${tpl.id}`);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await fetch(`/api/quote-templates/${id}`, { method: "DELETE" });
    toast.success("Szablon usunięty");
    qc.invalidateQueries({ queryKey: ["quote-templates"] });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Szablony wycen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gotowe układy wycen z domyślnymi pozycjami</p>
        </div>
        <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nowy szablon
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Brak szablonów</p>
          <p className="text-xs mt-1">Utwórz szablon z domyślnymi pozycjami i warunkami</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => {
            const itemCount = tpl.packages.reduce((s, p) => s + (p.items as unknown[]).length, 0);
            return (
              <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between group hover:border-red-200 transition-colors">
                <button className="flex-1 text-left" onClick={() => router.push(`/settings/quote-templates/${tpl.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{tpl.name}</span>
                    {tpl.serviceType && <Badge variant="outline" className="text-xs">{tpl.serviceType}</Badge>}
                    <span className="text-xs text-gray-400">{itemCount} pozycji</span>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => router.push(`/settings/quote-templates/${tpl.id}`)} className="p-1 text-gray-400 hover:text-gray-700">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(tpl.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nowy szablon wyceny</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nazwa *</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm(p => ({...p, name: e.target.value}))} placeholder="np. Montaż CCTV dom jednorodzinny" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Typ usługi</Label>
              <Select value={newForm.serviceType} onValueChange={(v) => setNewForm(p => ({...p, serviceType: v}))}>
                <SelectTrigger><SelectValue placeholder="Wszystkie typy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie typy</SelectItem>
                  {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Warunki realizacji (domyślne)</Label>
              <Textarea value={newForm.conditions} onChange={(e) => setNewForm(p => ({...p, conditions: e.target.value}))} rows={2} className="text-sm" placeholder="Terminy płatności, gwarancja..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Anuluj</Button>
            <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={create} disabled={saving}>
              {saving ? "Tworzenie..." : "Utwórz i edytuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
