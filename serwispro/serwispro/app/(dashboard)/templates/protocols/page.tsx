"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProtocolTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

export default function ProtocolTemplatesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["protocol-templates"],
    queryFn: async () => {
      const r = await fetch("/api/protocol-templates");
      return r.json();
    },
  });

  const templates: ProtocolTemplate[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/protocol-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      });
      if (!r.ok) throw new Error("Błąd tworzenia szablonu");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocol-templates"] });
      toast.success("Szablon został dodany");
      setShowForm(false);
      setName("");
      setContent("");
    },
    onError: () => toast.error("Błąd tworzenia szablonu"),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/protocol-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, content: editContent }),
      });
      if (!r.ok) throw new Error("Błąd aktualizacji szablonu");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocol-templates"] });
      toast.success("Szablon zaktualizowany");
      setEditingId(null);
    },
    onError: () => toast.error("Błąd aktualizacji szablonu"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/protocol-templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Błąd usuwania szablonu");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocol-templates"] });
      toast.success("Szablon usunięty");
    },
    onError: () => toast.error("Błąd usuwania szablonu"),
  });

  const startEdit = (t: ProtocolTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditContent(t.content);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Szablony protokołów</h1>
          <p className="text-sm text-gray-500 mt-0.5">Globalne szablony treści używane przy tworzeniu protokołów</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Dodaj szablon</span>
          </Button>
        )}
      </div>

      {/* Form nowego szablonu */}
      {showForm && (
        <div className="bg-white rounded-xl border p-5 mb-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Nowy szablon</h2>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Nazwa szablonu *</Label>
            <Input
              id="new-name"
              placeholder="np. Przegląd instalacji gazowej..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-content">Treść *</Label>
            <Textarea
              id="new-content"
              rows={6}
              placeholder="Treść szablonu, która zostanie wklejona do opisu protokołu..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || !content.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Zapisywanie..." : "Zapisz szablon"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setName(""); setContent(""); }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}

      {/* Lista szablonów */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak szablonów protokołów</p>
          <p className="text-sm mt-1">Dodaj pierwszy szablon, aby używać go przy tworzeniu protokołów</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              {editingId === t.id ? (
                <div className="space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nazwa szablonu"
                  />
                  <Textarea
                    rows={5}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Treść szablonu"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate(t.id)}
                      disabled={!editName.trim() || !editContent.trim() || updateMutation.isPending}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Zapisz
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" />
                      Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-gray-700"
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(t.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{t.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
