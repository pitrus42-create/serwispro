"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, StickyNote, CheckSquare } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type QuickItem = {
  id: string;
  type: "note" | "task";
  text: string;
  createdAt: string;
};

function formatItemDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Dzisiaj";
  if (isYesterday(date)) return "Wczoraj";
  return format(date, "d MMM", { locale: pl });
}

export function PersonalPanel() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<"note" | "task">("note");
  const [input, setInput] = useState("");
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: notesData } = useQuery({
    queryKey: ["me-notes"],
    queryFn: async () => {
      const r = await fetch("/api/me/notes");
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["me-tasks"],
    queryFn: async () => {
      const r = await fetch("/api/me/tasks");
      return r.json();
    },
    staleTime: 60_000,
  });

  // ── Merged + sorted list ──────────────────────────────────────────────────
  const items: QuickItem[] = useMemo(() => {
    const notes = (notesData?.data ?? []).map((n: { id: string; content: string; createdAt: string }) => ({
      id: n.id,
      type: "note" as const,
      text: n.content,
      createdAt: n.createdAt,
    }));
    const tasks = (tasksData?.data ?? []).map((t: { id: string; content: string; createdAt: string }) => ({
      id: t.id,
      type: "task" as const,
      text: t.content,
      createdAt: t.createdAt,
    }));
    return [...notes, ...tasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notesData, tasksData]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createNote = useMutation({
    mutationFn: async (content: string) => {
      const r = await fetch("/api/me/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error("Błąd dodawania notatki");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async (content: string) => {
      const r = await fetch("/api/me/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error("Błąd dodawania zadania");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/me/notes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Błąd usuwania");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/me/tasks/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Błąd usuwania");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (activeType === "note") createNote.mutate(text);
    else createTask.mutate(text);
    setInput("");
  }

  function handleCompleteTask(id: string) {
    if (completing.has(id)) return;
    setCompleting((prev) => new Set(prev).add(id));
    setTimeout(() => {
      deleteTask.mutate(id);
      setCompleting((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }, 1400);
  }

  function handleDelete(item: QuickItem) {
    if (item.type === "note") deleteNote.mutate(item.id);
    else deleteTask.mutate(item.id);
  }

  const isPending = createNote.isPending || createTask.isPending;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Notatki i zadania
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveType("note")}
            title="Notatka"
            className={cn(
              "p-1 rounded transition-colors",
              activeType === "note"
                ? "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            <StickyNote className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveType("task")}
            title="Zadanie"
            className={cn(
              "p-1 rounded transition-colors",
              activeType === "task"
                ? "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            <CheckSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Input row */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeType === "note" ? "Dodaj notatkę..." : "Dodaj zadanie..."}
          disabled={isPending}
          className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800 focus:border-red-800 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isPending}
          className="p-1.5 rounded-md bg-red-800 text-white hover:bg-red-900 disabled:opacity-40 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Scrollable list */}
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Brak notatek i zadań</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto scrollbar-none">
          {items.map((item) => {
            const isCompleting = completing.has(item.id);
            return (
              <li
                key={`${item.type}-${item.id}`}
                className={cn(
                  "flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all duration-500",
                  isCompleting
                    ? "bg-green-50 dark:bg-green-950/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
              >
                {/* Left icon / checkbox */}
                {item.type === "task" ? (
                  <button
                    onClick={() => handleCompleteTask(item.id)}
                    disabled={isCompleting}
                    className={cn(
                      "shrink-0 w-4 h-4 mt-0.5 rounded border-2 transition-all duration-300 flex items-center justify-center",
                      isCompleting
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-red-800"
                    )}
                  >
                    {isCompleting && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </button>
                ) : (
                  <StickyNote className="shrink-0 h-3.5 w-3.5 mt-0.5 text-amber-500" />
                )}

                {/* Text + date */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-snug transition-all duration-500",
                      isCompleting
                        ? "line-through text-gray-400 dark:text-gray-500 opacity-60"
                        : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {item.text}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {formatItemDate(item.createdAt)}
                  </p>
                </div>

                {/* Delete button */}
                {!isCompleting && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="shrink-0 text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded px-2 py-0.5 mt-0.5 transition-colors"
                  >
                    Ok
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
