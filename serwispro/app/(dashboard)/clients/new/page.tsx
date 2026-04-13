"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  type: z.string().min(1),
  name: z.string().optional(),
  alias: z.string().optional(),
  nip: z.string().optional(),
  phone: z.string().optional(),
  phoneAlt: z.string().optional(),
  email: z.string().email("Nieprawidłowy email").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "FIRMA" },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Błąd tworzenia klienta");
      }
      const { data: client } = await res.json();
      toast.success("Klient został dodany");
      router.push(`/clients/${client.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd tworzenia klienta");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Nowy klient</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white rounded-xl border p-5">
        <div className="space-y-1.5">
          <Label>Typ klienta</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRMA">Firma</SelectItem>
                  <SelectItem value="OSOBA_PRYWATNA">Osoba prywatna</SelectItem>
                  <SelectItem value="INSTYTUCJA">Instytucja</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Nazwa</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Nazwa firmy lub imię i nazwisko"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="alias">Wewnętrzna nazwa / pseudonim</Label>
          <Input id="alias" {...register("alias")} placeholder="Np. skrócona nazwa do wyszukiwania..." />
          <p className="text-xs text-gray-400">Widoczna tylko wewnętrznie — nie pojawia się w protokołach</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register("phone")} placeholder="+48 600 100 200" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phoneAlt">Telefon alternatywny</Label>
            <Input id="phoneAlt" {...register("phoneAlt")} placeholder="+48 22 100 200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="kontakt@firma.pl" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nip">NIP</Label>
            <Input id="nip" {...register("nip")} placeholder="1234567890" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Adres</Label>
          <Input id="address" {...register("address")} placeholder="ul. Przykładowa 1, 00-001 Warszawa" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notatki</Label>
          <Textarea id="notes" {...register("notes")} rows={3} placeholder="Dodatkowe informacje o kliencie..." />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            Anuluj
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Dodawanie..." : "Dodaj klienta"}
          </Button>
        </div>
      </form>
    </div>
  );
}
