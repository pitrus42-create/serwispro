"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  FileText,
  Package,
  CheckSquare,
  Activity,
  Paperclip,
  Download,
  FilePlus,
  ImageIcon,
  X,
  CheckCircle2,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { canDo, isAdmin } from "@/lib/permissions";

const STATUS_LABELS: Record<string, string> = {
  OCZEKUJACE: "Oczekujące",
  PRZYJETE: "Przyjęte",
  W_TOKU: "W toku",
  ZAPLANOWANE: "Zaplanowane",
  ZAKONCZONE: "Zakończone",
  ANULOWANE: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  OCZEKUJACE: "bg-gray-100 text-gray-700",
  PRZYJETE: "bg-blue-100 text-blue-700",
  W_TOKU: "bg-amber-100 text-amber-700",
  ZAPLANOWANE: "bg-purple-100 text-purple-700",
  ZAKONCZONE: "bg-green-100 text-green-700",
  ANULOWANE: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  NISKI: "bg-gray-100 text-gray-600",
  NORMALNY: "bg-blue-100 text-blue-600",
  WYSOKI: "bg-orange-100 text-orange-600",
  KRYTYCZNY: "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja",
  MONTAZ: "Montaż",
  MODERNIZACJA: "Modernizacja",
  INNE: "Inne",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  OCZEKUJACE: ["PRZYJETE", "ANULOWANE"],
  PRZYJETE: ["W_TOKU", "ZAPLANOWANE", "ANULOWANE"],
  ZAPLANOWANE: ["W_TOKU", "ANULOWANE"],
  W_TOKU: ["ZAKONCZONE", "PRZYJETE"],
  ZAKONCZONE: [],
  ANULOWANE: [],
};

interface OrderChecklistItem {
  id: string;
  text: string;
  isChecked: boolean;
  itemOrder: number;
  note: string | null;
}

interface OrderChecklist {
  id: string;
  name: string;
  items: OrderChecklistItem[];
}

interface Protocol {
  id: string;
  protocolNumber: string;
  type: string;
  content: string;
  pdfGenerated: boolean;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  priority: string;
  isCritical: boolean;
  title: string | null;
  description: string | null;
  internalNotes: string | null;
  scheduledAt: string | null;
  scheduledEndAt: string | null;
  completedAt: string | null;
  client: { id: string; name: string; phone: string | null; email: string | null } | null;
  location: { id: string; name: string; address: string | null; city: string | null } | null;
  assignments: Array<{
    isLead: boolean;
    user: { id: string; firstName: string; lastName: string };
  }>;
  checklists: OrderChecklist[];
  materials: Array<{
    id: string;
    quantity: number;
    unitPrice: number | null;
    notes: string | null;
    stockItem: { name: string; unit: string };
  }>;
  attachments: Array<{ id: string; fileName: string; fileUrl: string; uploadedAt: string }>;
  activityLog: ActivityLog[];
  protocols: Protocol[];
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("info");

  // Compress image to max 1600px, JPEG 80% — reduces phone photos from ~5MB to ~300KB
  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob
            ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
            : file
          ),
          "image/jpeg", 0.8
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  const [protocolDescription, setProtocolDescription] = useState("");
  const [protocolNotes, setProtocolNotes] = useState("");
  const [protocolHoursFrom, setProtocolHoursFrom] = useState("");
  const [protocolHoursTo, setProtocolHoursTo] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [protocolPhotos, setProtocolPhotos] = useState<File[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const order: Order | undefined = data?.data;

  const { data: templatesData } = useQuery({
    queryKey: ["protocol-templates"],
    queryFn: async () => {
      const r = await fetch("/api/protocol-templates");
      return r.json();
    },
    enabled: activeTab === "protocols",
  });
  const protocolTemplates: Array<{ id: string; name: string; content: string }> = templatesData?.data ?? [];

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const r = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error("Błąd zmiany statusu");
      return r.json();
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Status zmieniony na: ${STATUS_LABELS[newStatus]}`);
    },
    onError: () => toast.error("Błąd zmiany statusu"),
  });

  const checklistMutation = useMutation({
    mutationFn: async ({ checklistId, itemId, isChecked }: { checklistId: string; itemId: string; isChecked: boolean }) => {
      const r = await fetch(`/api/orders/${id}/checklists/${checklistId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked }),
      });
      if (!r.ok) throw new Error("Błąd");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["order", id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/orders/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Błąd przyjęcia zlecenia");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Zlecenie przyjęte — jesteś teraz przypisanym serwisantem");
    },
    onError: () => toast.error("Błąd przyjęcia zlecenia"),
  });

  const protocolMutation = useMutation({
    mutationFn: async ({ variant, content, photos }: {
      variant: "print" | "report";
      content: { description: string; notes: string; hoursFrom?: string; hoursTo?: string };
      photos: File[];
    }) => {
      const type = variant === "report" ? "raport" : "protokol";
      const r = await fetch(`/api/orders/${id}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content }),
      });
      if (!r.ok) throw new Error("Błąd tworzenia protokołu");
      const res = await r.json();
      const protocol = res.data;

      // Upload photos inside mutationFn so they're guaranteed to complete
      if (variant === "report" && photos.length > 0) {
        const fd = new FormData();
        photos.forEach((f) => fd.append("photos", f));
        const photoRes = await fetch(`/api/orders/${id}/protocols/${protocol.id}/photos`, {
          method: "POST",
          body: fd,
        });
        if (!photoRes.ok) throw new Error("Błąd przesyłania zdjęć");
      }

      return { protocol, variant, photoCount: photos.length };
    },
    onSuccess: ({ protocol, variant, photoCount }) => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      const photoInfo = variant === "report" && photoCount > 0
        ? ` (${photoCount} ${photoCount === 1 ? "zdjęcie" : "zdjęcia"})`
        : "";
      toast.success(
        `Protokół ${protocol.protocolNumber} został utworzony${photoInfo} — kliknij „Podgląd" aby go otworzyć`,
        { duration: 5000 }
      );
      setProtocolDescription("");
      setProtocolNotes("");
      setProtocolHoursFrom("");
      setProtocolHoursTo("");
      setProtocolPhotos([]);
      setSelectedTemplateIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProtocolMutation = useMutation({
    mutationFn: async (pid: string) => {
      const r = await fetch(`/api/orders/${id}/protocols/${pid}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.message ?? "Błąd usuwania protokołu");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Protokół został usunięty");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Nie znaleziono zlecenia</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/orders")}>
          Powrót do listy
        </Button>
      </div>
    );
  }

  const lead = order.assignments.find((a) => a.isLead);
  const helpers = order.assignments.filter((a) => !a.isLead);
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];
  const canCreate = canDo(session?.user, "orders:create");
  const canDeleteProtocol = isAdmin(session?.user);
  const isAssignedToMe = order.assignments.some((a) => a.user.id === session?.user?.id);
  const isUnassigned = order.assignments.length === 0;
  // Can close: roles with orders:close permission OR serwisant assigned to this order
  const canClose = canDo(session?.user, "orders:close") || (isAssignedToMe && !canCreate);
  const canAccept = !canCreate && (isUnassigned || isAssignedToMe) && ["OCZEKUJACE", "PRZYJETE"].includes(order.status) && !isAssignedToMe;
  const hasProtocol = (order.protocols?.length ?? 0) > 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-400">{order.orderNumber}</span>
            {order.isCritical && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-semibold animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5" />
                KRYTYCZNA
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {order.title ?? order.client?.name ?? `Zlecenie ${order.orderNumber}`}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={cn(STATUS_COLORS[order.status])}>
              {STATUS_LABELS[order.status]}
            </Badge>
            <Badge className={cn(PRIORITY_COLORS[order.priority])}>
              {order.priority}
            </Badge>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {TYPE_LABELS[order.type] ?? order.type}
            </span>
          </div>
        </div>
      </div>

      {/* Accept button for serwisant — unassigned orders */}
      {canAccept && (
        <div className="mb-4">
          <Button
            className="bg-green-600 hover:bg-green-700 gap-2"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            <UserPlus className="h-4 w-4" />
            Przyjmij zlecenie
          </Button>
          <p className="text-xs text-gray-400 mt-1">Zostaniesz przypisany jako serwisant odpowiedzialny</p>
        </div>
      )}

      {/* Status change — show to all except "Zakończone" which serwisant does via protocol */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {nextStatuses
            .filter((s) => canCreate || s !== "ZAKONCZONE") // serwisant zamyka przez protokół
            .map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "ZAKONCZONE" ? "default" : s === "ANULOWANE" ? "destructive" : "outline"}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                → {STATUS_LABELS[s]}
              </Button>
            ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 w-full sm:w-auto">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Szczegóły</span>
          </TabsTrigger>
          <TabsTrigger value="checklists" className="flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Checklista</span>
            {order.checklists.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5">
                {order.checklists.reduce((a, c) => a + c.items.filter((i) => i.isChecked).length, 0)}/
                {order.checklists.reduce((a, c) => a + c.items.length, 0)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Materiały</span>
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" />
            <span className="hidden sm:inline">Pliki</span>
          </TabsTrigger>
          <TabsTrigger value="protocols" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Protokoły</span>
            {(order.protocols?.length ?? 0) > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5">
                {order.protocols.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Historia</span>
          </TabsTrigger>
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client & Location */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Klient
              </h3>
              {order.client ? (
                <div>
                  <p className="font-medium">{order.client.name}</p>
                  {order.client.phone && <p className="text-sm text-gray-500">{order.client.phone}</p>}
                  {order.client.email && <p className="text-sm text-gray-500">{order.client.email}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Brak klienta</p>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Lokalizacja
              </h3>
              {order.location ? (
                <div>
                  <p className="font-medium">{order.location.name}</p>
                  {order.location.address && (
                    <p className="text-sm text-gray-500">{order.location.address}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Brak lokalizacji</p>
              )}
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Termin
              </h3>
              {order.scheduledAt ? (
                <div>
                  <p className="font-medium">
                    {format(new Date(order.scheduledAt), "d MMMM yyyy, HH:mm", { locale: pl })}
                  </p>
                  {order.scheduledEndAt && (
                    <p className="text-sm text-gray-500">
                      do {format(new Date(order.scheduledEndAt), "HH:mm", { locale: pl })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nie ustalono terminu</p>
              )}
              {order.completedAt && (
                <p className="text-sm text-green-600">
                  Zakończono: {format(new Date(order.completedAt), "d MMM yyyy, HH:mm", { locale: pl })}
                </p>
              )}
            </div>

            {/* Assignees */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Przypisani
              </h3>
              {lead ? (
                <div>
                  <p className="font-medium">{lead.user.firstName} {lead.user.lastName}</p>
                  <p className="text-xs text-gray-400">Odpowiedzialny</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nieprzypisane</p>
              )}
              {helpers.length > 0 && (
                <div className="space-y-1">
                  {helpers.map((h) => (
                    <p key={h.user.id} className="text-sm text-gray-600">
                      {h.user.firstName} {h.user.lastName}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {order.description && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-700 mb-2">Opis</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.description}</p>
            </div>
          )}

          {/* Internal notes */}
          {order.internalNotes && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <h3 className="font-semibold text-amber-800 mb-2">Notatki wewnętrzne</h3>
              <p className="text-sm text-amber-700 whitespace-pre-wrap">{order.internalNotes}</p>
            </div>
          )}
        </TabsContent>

        {/* Checklists tab */}
        <TabsContent value="checklists" className="space-y-4">
          {order.checklists.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Brak checklisty dla tego zlecenia</p>
            </div>
          ) : (
            order.checklists.map((checklist) => {
              const doneCount = checklist.items.filter((i) => i.isChecked).length;
              return (
                <div key={checklist.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{checklist.name}</h3>
                    <span className="text-sm text-gray-500">{doneCount}/{checklist.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {checklist.items.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={(e) =>
                            checklistMutation.mutate({ checklistId: checklist.id, itemId: item.id, isChecked: e.target.checked })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-600"
                        />
                        <span
                          className={cn(
                            "text-sm",
                            item.isChecked ? "line-through text-gray-400" : "text-gray-700",
                            !item.isChecked && "font-medium"
                          )}
                        >
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Materials tab */}
        <TabsContent value="materials">
          {order.materials.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Brak użytych materiałów</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Materiał</th>
                    <th className="text-right p-3 font-medium text-gray-600">Ilość</th>
                    <th className="text-right p-3 font-medium text-gray-600">Cena j.</th>
                    <th className="text-right p-3 font-medium text-gray-600">Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {order.materials.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{m.stockItem.name}</p>
                        {m.notes && <p className="text-xs text-gray-400">{m.notes}</p>}
                      </td>
                      <td className="p-3 text-right text-gray-600">
                        {m.quantity} {m.stockItem.unit}
                      </td>
                      <td className="p-3 text-right text-gray-600">
                        {m.unitPrice != null ? `${m.unitPrice.toFixed(2)} zł` : "—"}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {m.unitPrice != null ? `${(m.quantity * m.unitPrice).toFixed(2)} zł` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Attachments tab */}
        <TabsContent value="attachments">
          {order.attachments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Brak załączników</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {order.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white rounded-xl border p-3 hover:bg-gray-50 transition-colors"
                >
                  <Paperclip className="h-5 w-5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{att.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(att.uploadedAt), "d MMM yyyy", { locale: pl })}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Protocols tab */}
        <TabsContent value="protocols" className="space-y-4">
          {/* Existing protocols */}
          {(order.protocols?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700 text-sm">Wygenerowane protokoły</h3>
              {order.protocols.map((p) => {
                let parsed: Record<string, string> = {};
                try { parsed = JSON.parse(p.content); } catch { /* empty */ }
                const isReport = p.type === "raport";
                const pdfVariant = isReport ? "report" : "print";
                return (
                  <div key={p.id} className="bg-white rounded-lg border p-4 flex items-center gap-3">
                    {isReport
                      ? <ImageIcon className="h-5 w-5 text-purple-500 shrink-0" />
                      : <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.protocolNumber}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isReport ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {isReport ? "Raport" : "Protokół"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {format(new Date(p.createdAt), "d MMM yyyy, HH:mm", { locale: pl })}
                        {parsed.description && ` · ${parsed.description.slice(0, 50)}${parsed.description.length > 50 ? "…" : ""}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {canDeleteProtocol && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Usuń protokół"
                              disabled={deleteProtocolMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Usunąć protokół?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Protokół <strong>{p.protocolNumber}</strong> oraz wszystkie powiązane
                                zdjęcia zostaną trwale usunięte. Tej operacji nie można cofnąć.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anuluj</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteProtocolMutation.mutate(p.id)}
                              >
                                Usuń
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        title="Podgląd w nowej karcie"
                        onClick={() => window.open(`/api/orders/${id}/protocols/${p.id}/pdf?variant=${pdfVariant}`, "_blank")}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Podgląd
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        title="Otwórz i zapisz jako PDF (Ctrl+P → Zapisz jako PDF)"
                        onClick={() => window.open(
                          `/api/orders/${id}/protocols/${p.id}/pdf?variant=${pdfVariant}&print=1`,
                          "_blank"
                        )}
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New protocol form */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-blue-500" />
                Nowy protokół
              </h3>
              {canClose && order.status !== "ZAKONCZONE" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1.5"
                      disabled={!hasProtocol}
                      title={!hasProtocol ? "Najpierw wygeneruj protokół" : undefined}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Zakończ zlecenie
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zakończyć zlecenie?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Zlecenie {order.orderNumber} zostanie oznaczone jako{" "}
                        <strong>Zakończone</strong>. Protokół został wygenerowany.
                        Tej operacji nie można cofnąć bez pomocy administratora.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => statusMutation.mutate("ZAKONCZONE")}
                      >
                        Tak, zakończ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            {!hasProtocol && canClose && order.status !== "ZAKONCZONE" && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Aby zakończyć zlecenie, najpierw wygeneruj protokół serwisowy.
              </p>
            )}

            {/* Selektor szablonów */}
            {protocolTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Szablony (opcjonalnie)</Label>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {protocolTemplates.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-3 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTemplateIds.has(t.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTemplateIds((prev) => {
                            const next = new Set(prev);
                            checked ? next.add(t.id) : next.delete(t.id);
                            return next;
                          });
                          if (checked) {
                            setProtocolDescription((prev) =>
                              prev ? prev + "\n\n" + t.content : t.content
                            );
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{t.name}</p>
                        <p className="text-xs text-gray-400 truncate">{t.content}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="proto-desc">Opis wykonanych prac *</Label>
              <Textarea
                id="proto-desc"
                rows={4}
                placeholder="Opisz szczegółowo wykonane czynności serwisowe..."
                value={protocolDescription}
                onChange={(e) => setProtocolDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proto-notes">Uwagi / zalecenia</Label>
              <Textarea
                id="proto-notes"
                rows={2}
                placeholder="Dodatkowe uwagi, zalecenia dla klienta..."
                value={protocolNotes}
                onChange={(e) => setProtocolNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proto-hours-from">Godzina rozpoczęcia (opcjonalnie)</Label>
                <input
                  id="proto-hours-from"
                  type="time"
                  value={protocolHoursFrom}
                  onChange={(e) => setProtocolHoursFrom(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proto-hours-to">Godzina zakończenia (opcjonalnie)</Label>
                <input
                  id="proto-hours-to"
                  type="time"
                  value={protocolHoursTo}
                  onChange={(e) => setProtocolHoursTo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Upload zdjęć */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wide">
                Zdjęcia dokumentacji (max 6)
              </Label>
              {protocolPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {protocolPhotos.map((f, i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-lg overflow-hidden border bg-gray-50 relative group"
                    >
                      <img
                        src={URL.createObjectURL(f)}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProtocolPhotos((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                id="proto-photos"
                onChange={async (e) => {
                  const raw = Array.from(e.target.files ?? []).slice(0, 6);
                  e.target.value = "";
                  const compressed = await Promise.all(raw.map(compressImage));
                  setProtocolPhotos(compressed);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("proto-photos")?.click()}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                {protocolPhotos.length > 0
                  ? `${protocolPhotos.length} ${protocolPhotos.length === 1 ? "zdjęcie" : "zdjęcia"} wybrane`
                  : "Dodaj zdjęcia"}
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => protocolMutation.mutate({
                  variant: "print",
                  photos: [],
                  content: { description: protocolDescription, notes: protocolNotes, hoursFrom: protocolHoursFrom || undefined, hoursTo: protocolHoursTo || undefined },
                })}
                disabled={!protocolDescription.trim() || protocolMutation.isPending}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {protocolMutation.isPending ? "Generowanie..." : "Generuj Protokół"}
              </Button>
              <Button
                variant="outline"
                onClick={() => protocolMutation.mutate({
                  variant: "report",
                  photos: protocolPhotos,
                  content: { description: protocolDescription, notes: protocolNotes, hoursFrom: protocolHoursFrom || undefined, hoursTo: protocolHoursTo || undefined },
                })}
                disabled={!protocolDescription.trim() || protocolMutation.isPending}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                {protocolMutation.isPending ? "Generowanie..." : "Generuj Raport (ze zdjęciami)"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Protokół — do druku z podpisami. Raport — z dokumentacją zdjęciową, gotowy do wysyłki emailem.
            </p>
          </div>
        </TabsContent>

        {/* Activity log tab */}
        <TabsContent value="log">
          {order.activityLog.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Brak historii</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {order.activityLog.map((entry, index) => (
                <div key={entry.id} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    {index < order.activityLog.length - 1 && (
                      <div className="flex-1 w-px bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {entry.user.firstName} {entry.user.lastName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(entry.createdAt), "d MMM, HH:mm", { locale: pl })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {entry.details ?? entry.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
