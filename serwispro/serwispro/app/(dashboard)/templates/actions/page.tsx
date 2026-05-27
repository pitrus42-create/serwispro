"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

interface ActionTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  isActive: boolean;
}

export default function ActionTemplatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["action-templates"],
    queryFn: async () => {
      const r = await fetch("/api/action-templates");
      return r.json();
    },
  });

  const templates: ActionTemplate[] = data?.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Szablony czynności</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Brak szablonów</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                {t.category && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {t.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{t.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
