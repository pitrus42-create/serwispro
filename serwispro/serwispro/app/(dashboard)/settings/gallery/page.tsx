"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Camera, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SERVICE_TYPES = [
  { value: "CCTV", label: "CCTV" }, { value: "ALARM", label: "Alarm" },
  { value: "BRAMA", label: "Brama" }, { value: "DOMOFON", label: "Domofon" },
  { value: "SIEC", label: "Sieć" }, { value: "INNE", label: "Inne" },
];

interface GalleryPhoto { id: string; fileUrl: string; fileName: string | null; caption: string | null; isMain: boolean; }
interface GalleryItemData { id: string; title: string; description: string | null; serviceType: string | null; isPublic: boolean; photos: GalleryPhoto[]; }

export default function GalleryPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", description: "", serviceType: "", isPublic: true });
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: async () => {
      const res = await fetch("/api/gallery");
      return res.json() as Promise<GalleryItemData[]>;
    },
  });

  const createItem = async () => {
    if (!newForm.title) { toast.error("Podaj tytuł"); return; }
    const res = await fetch("/api/gallery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newForm, serviceType: newForm.serviceType || null }),
    });
    const item = await res.json();
    toast.success("Realizacja dodana");
    qc.invalidateQueries({ queryKey: ["gallery"] });
    setCreating(false);
    setActiveItem(item.id);
  };

  const removeItem = async (id: string) => {
    await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    toast.success("Usunięto realizację");
    qc.invalidateQueries({ queryKey: ["gallery"] });
  };

  const togglePublic = async (item: GalleryItemData) => {
    await fetch(`/api/gallery/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !item.isPublic }),
    });
    qc.invalidateQueries({ queryKey: ["gallery"] });
  };

  const uploadPhotos = async (itemId: string, files: FileList) => {
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("photos", f));
      await fetch(`/api/gallery/${itemId}/photos`, { method: "POST", body: fd });
      toast.success("Zdjęcia dodane");
      qc.invalidateQueries({ queryKey: ["gallery"] });
    } finally { setUploading(false); }
  };

  const removePhoto = async (itemId: string, photoId: string) => {
    await fetch(`/api/gallery/${itemId}/photos?photoId=${photoId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["gallery"] });
  };

  const active = items.find(i => i.id === activeItem);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Galeria realizacji</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zdjęcia ukończonych projektów — widoczne dla klientów w formularzu</p>
        </div>
        <Button size="sm" className="bg-red-800 hover:bg-red-900 text-white" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nowa realizacja
        </Button>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm">Nowa realizacja</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Tytuł *</Label><Input value={newForm.title} onChange={(e) => setNewForm(p => ({...p, title: e.target.value}))} placeholder="np. Montaż CCTV - dom prywatny Warszawa" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Typ usługi</Label>
              <Select value={newForm.serviceType} onValueChange={(v) => setNewForm(p => ({...p, serviceType: v}))}>
                <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent><SelectItem value="">Ogólne</SelectItem>{SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Krótki opis</Label><Input value={newForm.description} onChange={(e) => setNewForm(p => ({...p, description: e.target.value}))} placeholder="Montaż 8 kamer IP..." /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newForm.isPublic} onChange={(e) => setNewForm(p => ({...p, isPublic: e.target.checked}))} className="accent-red-800" />
            Widoczna publicznie (w formularzu klienta)
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={createItem} className="bg-red-800 hover:bg-red-900 text-white">Utwórz</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Anuluj</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Brak realizacji w galerii</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden group">
              {/* Miniaturki */}
              <div className="grid grid-cols-3 gap-0.5 bg-gray-100 aspect-[3/1]">
                {item.photos.slice(0, 3).map(photo => (
                  <img key={photo.id} src={photo.fileUrl} alt="" className="w-full h-full object-cover" />
                ))}
                {item.photos.length === 0 && (
                  <div className="col-span-3 flex items-center justify-center bg-gray-100 text-gray-300">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.serviceType && <Badge variant="outline" className="text-xs">{item.serviceType}</Badge>}
                      <span className="text-xs text-gray-400">{item.photos.length} zdjęć</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => togglePublic(item)} className="p-1 text-gray-400 hover:text-gray-700" title={item.isPublic ? "Ukryj" : "Pokaż"}>
                      {item.isPublic ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setActiveItem(activeItem === item.id ? null : item.id)} className="p-1 text-gray-400 hover:text-gray-700">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeItem(item.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {activeItem === item.id && (
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {item.photos.map(photo => (
                        <div key={photo.id} className="relative group/photo rounded overflow-hidden">
                          <img src={photo.fileUrl} alt="" className="w-full aspect-square object-cover" />
                          <button onClick={() => removePhoto(item.id, photo.id)} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/photo:opacity-100 transition-opacity">
                            <span className="text-xs leading-none">×</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { fileRef.current?.setAttribute("data-item", item.id); fileRef.current?.click(); }} disabled={uploading} className="w-full text-xs border border-dashed border-gray-200 hover:border-red-300 rounded-lg py-2 text-gray-400 hover:text-red-800 transition-colors">
                      <Camera className="w-3.5 h-3.5 inline mr-1" /> {uploading ? "Wysyłanie..." : "Dodaj zdjęcia"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => {
          const itemId = fileRef.current?.getAttribute("data-item");
          if (e.target.files && itemId) uploadPhotos(itemId, e.target.files);
        }}
      />
    </div>
  );
}
