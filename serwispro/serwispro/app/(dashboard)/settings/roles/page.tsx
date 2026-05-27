"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { isSuperAdmin } from "@/lib/permissions";

type Role = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isCustom: boolean;
  _count: { userRoleAssignments: number; rolePermissions: number };
};

export default function RolesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const isSuper = isSuperAdmin(session?.user);

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const r = await fetch("/api/roles");
      return r.json();
    },
  });

  const roles: Role[] = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Błąd usuwania roli.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rola została usunięta.");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roles.length} ról w systemie</p>
        </div>
        {isSuper && (
          <Button
            onClick={() => router.push("/settings/roles/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nowa rola
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white rounded-xl border p-4 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{role.displayName}</p>
                  <span className="text-xs text-gray-400 font-mono">{role.name}</span>
                  {role.isSystem && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Systemowa
                    </span>
                  )}
                  {role.isCustom && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      Niestandardowa
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-500 truncate">{role.description}</p>
                )}
              </div>
              <div className="hidden sm:flex gap-4 text-xs text-gray-500 shrink-0">
                <span>{role._count.userRoleAssignments} użytkowników</span>
                <span>{role._count.rolePermissions} uprawnień</span>
              </div>
              {isSuper && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/settings/roles/${role.id}`)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setConfirmDelete(role)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń rolę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć rolę{" "}
              <strong>{confirmDelete?.displayName}</strong>? Tej operacji nie
              można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                confirmDelete && deleteMutation.mutate(confirmDelete.id)
              }
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
