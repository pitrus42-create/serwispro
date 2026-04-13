"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, StickyNote, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Note { id: string; content: string; createdAt: string; }
interface Task { id: string; content: string; createdAt: string; }

export function PersonalPanel() {
  const qc = useQueryClient();
  const [noteInput, setNoteInput] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [completing, setCompleting] = useState<Set<string>>(new Set());

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

  const notes: Note[] = notesData?.data ?? [];
  const tasks: Task[] = tasksData?.data ?? [];

  const createNote = useMutation({
    mutationFn: async (content: string) => {
      const r = await fetch("/api/me/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-notes"] });
      setNoteInput("");
    },
    onError: (e) => toast.error(`Błąd notatki: ${e.message}`),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/me/notes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-notes"] }),
    onError: (e) => toast.error(`Błąd usunięcia: ${e.message}`),
  });

  const createTask = useMutation({
    mutationFn: async (content: string) => {
      const r = await fetch("/api/me/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-tasks"] });
      setTaskInput("");
    },
    onError: (e) => toast.error(`Błąd zadania: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/me/tasks/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-tasks"] }),
    onError: (e) => toast.error(`Błąd usunięcia: ${e.message}`),
  });

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
    }, 1500);
  }

  return (
    <div className="space-y-4">
      {/* Notes */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-700">Notatki</h3>
          {notes.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{notes.length}</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (noteInput.trim()) createNote.mutate(noteInput.trim());
          }}
          className="flex gap-2 mb-3"
        >
          <input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Dodaj notatkę..."
            className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800 focus:border-red-800"
          />
          <button
            type="submit"
            disabled={!noteInput.trim() || createNote.isPending}
            className="p-1.5 rounded-md bg-red-800 text-white hover:bg-red-900 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Brak notatek</p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2"
              >
                <span className="flex-1 text-sm text-gray-700 leading-snug">
                  {note.content}
                </span>
                <button
                  onClick={() => deleteNote.mutate(note.id)}
                  className="shrink-0 text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 active:bg-green-300 rounded px-2 py-0.5 mt-0.5 transition-colors"
                >
                  Ok
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tasks / Checklist */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="h-4 w-4 text-red-800" />
          <h3 className="text-sm font-semibold text-gray-700">Zadania</h3>
          {tasks.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{tasks.length}</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (taskInput.trim()) createTask.mutate(taskInput.trim());
          }}
          className="flex gap-2 mb-3"
        >
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Nowe zadanie..."
            className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800 focus:border-red-800"
          />
          <button
            type="submit"
            disabled={!taskInput.trim() || createTask.isPending}
            className="p-1.5 rounded-md bg-red-800 text-white hover:bg-red-900 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Brak zadań</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((task) => {
              const isCompleting = completing.has(task.id);
              return (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-3 py-2 transition-all duration-500",
                    isCompleting ? "bg-green-50" : "bg-gray-50"
                  )}
                >
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={isCompleting}
                    className={cn(
                      "shrink-0 w-4 h-4 mt-0.5 rounded border-2 transition-all duration-300 flex items-center justify-center",
                      isCompleting
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 hover:border-red-800 bg-white"
                    )}
                  >
                    {isCompleting && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm leading-snug transition-all duration-500",
                      isCompleting
                        ? "line-through text-green-600 opacity-70"
                        : "text-gray-700"
                    )}
                  >
                    {task.content}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
