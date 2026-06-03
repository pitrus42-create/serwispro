"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OrderError]", error);
  }, [error]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4 text-center">
      <h2 className="text-xl font-bold text-gray-900">Coś poszło nie tak</h2>
      <p className="text-sm text-gray-500">
        {error.message || "Nie udało się załadować strony zlecenia."}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-2">
          Kod błędu: {error.digest}
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>Spróbuj ponownie</Button>
        <Button variant="outline" onClick={() => { window.location.href = "/orders"; }}>
          Powrót do listy
        </Button>
      </div>
    </div>
  );
}
