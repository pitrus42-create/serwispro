"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown,
  Bold, List, CheckSquare, X, BookOpen, Pencil,
  Save, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type ChecklistStatus =
  | "OK" | "WYKONANO" | "NAPRAWIONO" | "WYMIENIONO"
  | "SPRAWDZIC" | "USTERKA" | "BRAK_DOSTEPU" | "ND";

export interface ChecklistItem {
  id: string;
  text: string;
  status: ChecklistStatus;
  comment: string;
}

export interface WorkDescriptionData {
  type: "workDescription";
  text: string;
  checklist: {
    enabled: boolean;
    items: ChecklistItem[];
  };
}

export interface GlobalTemplate {
  id: string;
  name: string;
  defaultText: string;
  defaultChecklist: Array<{ text: string; status: string; comment: string }>;
  defaultNotes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Status config ──────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ChecklistStatus, { label: string; cls: string }> = {
  OK:           { label: "OK",             cls: "bg-green-50 text-green-700 border-green-200" },
  WYKONANO:     { label: "Wykonano",       cls: "bg-sky-50 text-sky-700 border-sky-200" },
  NAPRAWIONO:   { label: "Naprawiono",     cls: "bg-teal-50 text-teal-700 border-teal-200" },
  WYMIENIONO:   { label: "Wymieniono",     cls: "bg-violet-50 text-violet-700 border-violet-200" },
  SPRAWDZIC:    { label: "Do sprawdzenia", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  USTERKA:      { label: "Usterka",        cls: "bg-red-50 text-red-700 border-red-200" },
  BRAK_DOSTEPU: { label: "Brak dostępu",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  ND:           { label: "Nie dotyczy",    cls: "bg-gray-100 text-gray-400 border-gray-200" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultChecklist(): ChecklistItem[] {
  return [{ id: uid(), text: "", status: "OK", comment: "" }];
}

export function parseWorkDescription(v: string): WorkDescriptionData {
  const empty: WorkDescriptionData = {
    type: "workDescription",
    text: "",
    checklist: { enabled: false, items: [] },
  };
  if (!v?.trim()) return empty;
  try {
    const p = JSON.parse(v);
    if (p.type === "workDescription") {
      return {
        type: "workDescription",
        text: p.text ?? "",
        checklist: {
          enabled: p.checklist?.enabled ?? false,
          items: p.checklist?.items ?? [],
        },
      };
    }
    // Legacy: plain checklist mode
    if (p.type === "checklist") {
      return {
        type: "workDescription",
        text: "",
        checklist: { enabled: true, items: p.items ?? [] },
      };
    }
    // Legacy: table (no direct equivalent — drop)
    if (p.type === "table") return empty;
  } catch { /* plain text */ }
  return { ...empty, text: v };
}

export function serializeWorkDescription(data: WorkDescriptionData): string {
  return JSON.stringify(data);
}

export function getWorkDescriptionPreview(v: string): string {
  if (!v?.trim()) return "";
  try {
    const p = JSON.parse(v);
    if (p.type === "workDescription") {
      if (p.text?.trim()) {
        const t = p.text.trim();
        return t.slice(0, 80) + (t.length > 80 ? "…" : "");
      }
      if (p.checklist?.enabled && p.checklist?.items?.length) {
        return `Checklista: ${p.checklist.items.length} pozycji`;
      }
      return "";
    }
    if (p.type === "checklist") return `Checklista: ${p.items?.length ?? 0} pozycji`;
    if (p.type === "table") return "Tabela danych";
  } catch {}
  const plain = v.trim();
  return plain.slice(0, 80) + (plain.length > 80 ? "…" : "");
}

export function isValidWorkDescription(v: string): boolean {
  if (!v?.trim()) return false;
  try {
    const p = JSON.parse(v);
    if (p.type === "workDescription") {
      const hasText = !!p.text?.trim();
      const hasChecklist =
        p.checklist?.enabled &&
        p.checklist?.items?.some((i: ChecklistItem) => i.text.trim());
      return hasText || !!hasChecklist;
    }
    if (p.type === "checklist") return p.items?.some((i: { text: string }) => i.text.trim()) ?? false;
    if (p.type === "table") return (p.rows?.length ?? 0) > 0;
  } catch {}
  return !!v.trim();
}

// ── RichTextEditor ─────────────────────────────────────────────────────────

function RichTextEditor({
  value, onChange, rows = 4, placeholder,
}: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyBold() {
    const el = ref.current; if (!el) return;
    const s = el.selectionStart; const e = el.selectionEnd;
    const sel = value.slice(s, e).trim();
    const before = value.slice(0, s); const after = value.slice(e);
    if (sel) {
      onChange(`${before}**${sel}**${after}`);
      setTimeout(() => { el.focus(); el.setSelectionRange(s + 2, s + 2 + sel.length); }, 0);
    } else {
      onChange(`${before}**pogrubiony tekst**${after}`);
      setTimeout(() => { el.focus(); el.setSelectionRange(s + 2, s + 18); }, 0);
    }
  }

  function applyBullet() {
    const el = ref.current; if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineText = value.slice(lineStart, start);
    if (lineText.startsWith("- ")) {
      const nv = value.slice(0, lineStart) + value.slice(lineStart + 2);
      onChange(nv);
      setTimeout(() => { el.focus(); el.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, start - 2)); }, 0);
    } else {
      onChange(value.slice(0, lineStart) + "- " + value.slice(lineStart));
      setTimeout(() => { el.focus(); el.setSelectionRange(start + 2, start + 2); }, 0);
    }
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50/80">
        <button type="button" onClick={applyBold}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white hover:shadow-sm font-bold text-gray-600 transition-all">
          <Bold className="h-3 w-3" /> Pogrub
        </button>
        <button type="button" onClick={applyBullet}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white hover:shadow-sm text-gray-600 transition-all">
          <List className="h-3 w-3" /> Lista
        </button>
      </div>
      <Textarea ref={ref} rows={rows} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 shadow-none focus-visible:ring-0 rounded-none resize-none" />
    </div>
  );
}

// ── StatusSelect ───────────────────────────────────────────────────────────

function StatusSelect({
  value, onChange,
}: {
  value: ChecklistStatus; onChange: (v: ChecklistStatus) => void;
}) {
  const cfg = STATUS_CONFIG[value] ?? STATUS_CONFIG.OK;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChecklistStatus)}
      className={cn(
        "text-xs rounded-md px-2 py-1 font-medium cursor-pointer border appearance-none",
        "focus:outline-none focus:ring-1 focus:ring-gray-300 min-w-[110px]",
        cfg.cls,
      )}
    >
      {(Object.keys(STATUS_CONFIG) as ChecklistStatus[]).map((k) => (
        <option key={k} value={k} className="bg-white text-gray-900">
          {STATUS_CONFIG[k].label}
        </option>
      ))}
    </select>
  );
}

// ── OptionalChecklistEditor ─────────────────────────────────────────────────

export function OptionalChecklistEditor({
  items, onChange,
}: {
  items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void;
}) {
  function update(id: string, patch: Partial<ChecklistItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function add() {
    onChange([...items, { id: uid(), text: "", status: "OK", comment: "" }]);
  }
  function remove(id: string) {
    if (items.length > 1) onChange(items.filter((i) => i.id !== id));
  }
  function duplicate(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const clone = { ...items[idx], id: uid() };
    const next = [...items];
    next.splice(idx + 1, 0, clone);
    onChange(next);
  }
  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= items.length) return;
    const next = [...items];
    [next[idx], next[tgt]] = [next[tgt], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={item.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
          {/* Main row: [num] [input] [action buttons] [status — far right] */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
            <span className="text-xs text-gray-300 font-mono w-4 shrink-0 text-center select-none">
              {idx + 1}
            </span>
            <Input
              placeholder="Opis czynności..."
              value={item.text}
              onChange={(e) => update(item.id, { text: e.target.value })}
              className="flex-1 h-8 text-sm border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
            />
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={() => move(item.id, -1)} disabled={idx === 0}
                className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-20 touch-manipulation" title="Przesuń wyżej">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(item.id, 1)} disabled={idx === items.length - 1}
                className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-20 touch-manipulation" title="Przesuń niżej">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => duplicate(item.id)}
                className="p-1 text-gray-300 hover:text-blue-500 touch-manipulation" title="Duplikuj">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(item.id)} disabled={items.length === 1}
                className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-20 touch-manipulation" title="Usuń">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <StatusSelect value={item.status} onChange={(s) => update(item.id, { status: s })} />
          </div>
          {/* Comment row */}
          <div className="px-3 pb-2">
            <Input
              placeholder="Komentarz (opcjonalnie)..."
              value={item.comment}
              onChange={(e) => update(item.id, { comment: e.target.value })}
              className="h-7 text-xs border-gray-100 bg-gray-50 focus-visible:ring-0 text-gray-500 placeholder:text-gray-300"
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 w-full">
        <Plus className="h-3.5 w-3.5" />
        Dodaj pozycję
      </Button>
    </div>
  );
}

// ── GlobalTemplatePicker ───────────────────────────────────────────────────

export function GlobalTemplatePicker({
  onApply,
  onClose,
}: {
  onApply: (text: string, checklist: ChecklistItem[], notes: string) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/protocol-global-templates")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setTemplates(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function apply(t: GlobalTemplate) {
    const items: ChecklistItem[] = t.defaultChecklist.map((i) => ({
      id: uid(),
      text: i.text,
      status: (i.status as ChecklistStatus) in STATUS_CONFIG
        ? (i.status as ChecklistStatus)
        : "OK",
      comment: i.comment ?? "",
    }));
    onApply(t.defaultText, items, t.defaultNotes);
    onClose();
  }

  return (
    <div className="border rounded-xl bg-white shadow-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-gray-500" />
          Wybierz szablon
        </p>
        <button type="button" onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 py-4 text-center">Ładowanie szablonów…</p>
      )}

      {!loading && templates.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">Brak dostępnych szablonów</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {templates.map((t) => (
            <div key={t.id}
              className="border rounded-lg p-3 hover:border-gray-300 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  {t.defaultText && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {t.defaultText.slice(0, 100)}{t.defaultText.length > 100 ? "…" : ""}
                    </p>
                  )}
                  {t.defaultChecklist.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Checklista: {t.defaultChecklist.length} pozycji
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline"
                  className="shrink-0 text-xs h-7" onClick={() => apply(t)}>
                  Zastosuj
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GlobalTemplateManager ──────────────────────────────────────────────────

interface TemplateFormState {
  name: string;
  defaultText: string;
  defaultChecklist: ChecklistItem[];
  defaultNotes: string;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  defaultText: "",
  defaultChecklist: [],
  defaultNotes: "",
};

export function GlobalTemplateManager({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const r = await fetch("/api/protocol-global-templates");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setTemplates(d.data ?? []);
    } catch {
      // silently fail — templates stay empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTemplates(); }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(t: GlobalTemplate) {
    setForm({
      name: t.name,
      defaultText: t.defaultText,
      defaultChecklist: t.defaultChecklist.map((i) => ({
        id: uid(),
        text: i.text,
        status: (i.status as ChecklistStatus) in STATUS_CONFIG
          ? (i.status as ChecklistStatus)
          : "OK",
        comment: i.comment ?? "",
      })),
      defaultNotes: t.defaultNotes,
    });
    setEditingId(t.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(),
        defaultText: form.defaultText,
        defaultChecklist: form.defaultChecklist.map(({ text, status, comment }) => ({
          text, status, comment,
        })),
        defaultNotes: form.defaultNotes,
      };
      const url = editingId === "new"
        ? "/api/protocol-global-templates"
        : `/api/protocol-global-templates/${editingId}`;
      const method = editingId === "new" ? "POST" : "PUT";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => null);
        setSaveError(errData?.error ?? `Błąd ${r.status}`);
        return;
      }
      await fetchTemplates();
      cancelEdit();
    } catch {
      setSaveError("Błąd połączenia z serwerem");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Usunąć szablon?")) return;
    await fetch(`/api/protocol-global-templates/${id}`, { method: "DELETE" });
    await fetchTemplates();
    if (editingId === id) cancelEdit();
  }

  async function duplicate(t: GlobalTemplate) {
    const payload = {
      name: `${t.name} (kopia)`,
      defaultText: t.defaultText,
      defaultChecklist: t.defaultChecklist,
      defaultNotes: t.defaultNotes,
    };
    await fetch("/api/protocol-global-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchTemplates();
  }

  return (
    <div className="border rounded-xl bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <p className="text-sm font-semibold text-gray-800">Zarządzaj szablonami globalnymi</p>
        <button type="button" onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Template list */}
        {!editingId && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={startCreate}
              className="gap-1.5 w-full">
              <Plus className="h-3.5 w-3.5" />
              Nowy szablon
            </Button>
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-4">Ładowanie…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Brak szablonów</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {templates.map((t) => (
                  <div key={t.id}
                    className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:bg-gray-50/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {t.defaultChecklist.length > 0 ? `${t.defaultChecklist.length} poz.` : "brak checklisty"}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => startEdit(t)} title="Edytuj"
                        className="p-1.5 text-gray-400 hover:text-blue-600 touch-manipulation">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => duplicate(t)} title="Duplikuj"
                        className="p-1.5 text-gray-400 hover:text-gray-600 touch-manipulation">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteTemplate(t.id)} title="Usuń"
                        className="p-1.5 text-gray-400 hover:text-red-500 touch-manipulation">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Edit / Create form */}
        {editingId && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Nazwa szablonu *</label>
              <Input
                placeholder="np. Awaria CCTV"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Domyślny opis prac</label>
              <Textarea
                rows={3}
                placeholder="Domyślny tekst opisu..."
                value={form.defaultText}
                onChange={(e) => setForm((p) => ({ ...p, defaultText: e.target.value }))}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Domyślna checklista</label>
                <button type="button"
                  onClick={() => setForm((p) => ({
                    ...p,
                    defaultChecklist: [...p.defaultChecklist, { id: uid(), text: "", status: "OK", comment: "" }],
                  }))}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Dodaj pozycję
                </button>
              </div>
              {form.defaultChecklist.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Brak pozycji — szablon bez checklisty</p>
              ) : (
                <div className="space-y-1.5">
                  {form.defaultChecklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 border rounded-lg px-2 py-1.5 bg-white">
                      <span className="text-xs text-gray-300 w-4 text-center shrink-0">{idx + 1}</span>
                      <Input
                        placeholder="Czynność..."
                        value={item.text}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          defaultChecklist: p.defaultChecklist.map((i) =>
                            i.id === item.id ? { ...i, text: e.target.value } : i
                          ),
                        }))}
                        className="flex-1 h-7 text-xs border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
                      />
                      <select
                        value={item.status}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          defaultChecklist: p.defaultChecklist.map((i) =>
                            i.id === item.id ? { ...i, status: e.target.value as ChecklistStatus } : i
                          ),
                        }))}
                        className={cn(
                          "text-xs rounded px-1.5 py-0.5 border appearance-none cursor-pointer min-w-[90px]",
                          STATUS_CONFIG[item.status as ChecklistStatus]?.cls ?? "",
                        )}
                      >
                        {(Object.keys(STATUS_CONFIG) as ChecklistStatus[]).map((k) => (
                          <option key={k} value={k} className="bg-white text-gray-900">
                            {STATUS_CONFIG[k].label}
                          </option>
                        ))}
                      </select>
                      <button type="button"
                        onClick={() => setForm((p) => ({
                          ...p,
                          defaultChecklist: p.defaultChecklist.filter((i) => i.id !== item.id),
                        }))}
                        className="p-1 text-gray-300 hover:text-red-500 touch-manipulation">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Domyślne uwagi / zalecenia</label>
              <Textarea
                rows={2}
                placeholder="Domyślne uwagi..."
                value={form.defaultNotes}
                onChange={(e) => setForm((p) => ({ ...p, defaultNotes: e.target.value }))}
                className="text-sm"
              />
            </div>

            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {saveError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" onClick={save}
                disabled={!form.name.trim() || saving} className="gap-1.5 flex-1">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Zapisywanie…" : "Zapisz"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={cancelEdit}
                className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WorkDescriptionEditor (main) ───────────────────────────────────────────

export interface WorkDescriptionEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

export function WorkDescriptionEditor({
  value, onChange, rows = 4, placeholder,
}: WorkDescriptionEditorProps) {
  // Re-mount via key from parent resets all state by re-running lazy init
  const [data, setData] = useState<WorkDescriptionData>(() => parseWorkDescription(value));

  function update(patch: Partial<WorkDescriptionData>) {
    const next = { ...data, ...patch } as WorkDescriptionData;
    setData(next);
    onChange(serializeWorkDescription(next));
  }

  function addChecklist() {
    update({ checklist: { enabled: true, items: defaultChecklist() } });
  }

  function removeChecklist() {
    update({ checklist: { enabled: false, items: [] } });
  }

  function handleTextChange(text: string) {
    const next = { ...data, text };
    setData(next);
    onChange(serializeWorkDescription(next));
  }

  function handleChecklistChange(items: ChecklistItem[]) {
    const next = { ...data, checklist: { ...data.checklist, items } };
    setData(next);
    onChange(serializeWorkDescription(next));
  }

  return (
    <div className="space-y-3">
      {/* Checklista — na górze gdy aktywna */}
      {data.checklist.enabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              Checklista wykonanych czynności
            </p>
            <button type="button" onClick={removeChecklist}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 py-0.5">
              <X className="h-3 w-3" /> Usuń checklistę
            </button>
          </div>
          <OptionalChecklistEditor
            items={data.checklist.items.length > 0 ? data.checklist.items : defaultChecklist()}
            onChange={handleChecklistChange}
          />
        </div>
      )}

      {/* Przycisk dodania checklisty — gdy nieaktywna, PRZED opisem */}
      {!data.checklist.enabled && (
        <Button type="button" variant="outline" size="sm" onClick={addChecklist}
          className="gap-1.5 h-8 text-gray-600">
          <CheckSquare className="h-3.5 w-3.5" />
          Dodaj checklistę
        </Button>
      )}

      {/* Opis serwisu — zawsze poniżej checklisty / przycisku */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500">Opis serwisu</p>
        <RichTextEditor
          value={data.text}
          onChange={handleTextChange}
          rows={rows}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

// Backward-compat alias — existing imports in page.tsx still work
export const ProtocolDescriptionEditor = WorkDescriptionEditor;
export type ProtocolDescriptionEditorProps = WorkDescriptionEditorProps;
