"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface Notification {
  id: string;
  type: string;
  priority: number;
  title: string;
  message?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

async function fetchNotifications() {
  const res = await fetch("/api/notifications?read=false&limit=30");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<{ data: Notification[]; unreadCount: number }>;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    notifications: data?.data ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
