"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Shield, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const RULES = [
  { label: "Minimum 8 znaków", test: (p: string) => p.length >= 8 },
  { label: "Co najmniej jedna wielka litera", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Co najmniej jedna cyfra", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "Co najmniej jeden znak specjalny",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const allRulesPassed = RULES.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!allRulesPassed) {
      toast.error("Hasło nie spełnia wymagań bezpieczeństwa.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Hasła nie są identyczne.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Błąd zmiany hasła.");
        return;
      }

      toast.success("Hasło zostało zmienione. Możesz teraz korzystać z systemu.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Zmień hasło</CardTitle>
          <CardDescription>
            Ze względów bezpieczeństwa musisz ustawić nowe hasło przed
            kontynuowaniem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Hasło tymczasowe</Label>
              <div className="relative">
                <Input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Wpisz hasło tymczasowe"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new">Nowe hasło</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Wpisz nowe hasło"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {RULES.map((rule) => {
                    const passed = rule.test(newPassword);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${
                          passed ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Potwierdź nowe hasło</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Powtórz nowe hasło"
                required
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500">Hasła nie są identyczne.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !allRulesPassed || !passwordsMatch}
            >
              {loading ? "Zapisywanie..." : "Zmień hasło i przejdź do systemu"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
