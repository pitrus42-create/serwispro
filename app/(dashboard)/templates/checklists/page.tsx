"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TemplateItem {
  id: string;
  text: string;
  itemOrder: number;
  isRequired: boolean;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  orderType: string | null;
  isActive: boolean;
  items: TemplateItem[];
}

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja",
};

export default function ChecklistTemplatesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const r = await fetch("/api/checklist-templates");
      return r.json();
    },
  });

  const templates: ChecklistTemplate[] = data?.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Szablony checklisty</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak szablonów</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border overflow-hidden">
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <CheckSquare className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.orderType ? TYPE_LABELS[t.orderType] ?? t.orderType : "Wszystkie typy"} •{" "}
                    {t.items.length} pkt.
                  </p>
                </div>
                {expanded === t.id ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expanded === t.id && (
                <div className="border-t px-4 py-3 space-y-2">
                  {t.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400 w-5 text-right shrink-0">{item.itemOrder}.</span>
                      <span className={item.isRequired ? "font-medium" : "text-gray-600"}>
                        {item.text}
                        {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
