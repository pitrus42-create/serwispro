"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-red-400",
  3: "bg-amber-500",
  4: "bg-amber-400",
  5: "bg-red-600",
  6: "bg-red-400",
  7: "bg-gray-300",
};

export function NotificationPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Powiadomienia
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                  {unreadCount}
                </span>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead()}
                className="text-xs"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Wszystkie przeczytane
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-60px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Brak powiadomień</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer",
                    !n.isRead && "bg-red-50/50"
                  )}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id);
                  }}
                >
                  <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", PRIORITY_COLORS[n.priority] ?? "bg-gray-300")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", !n.isRead && "font-semibold text-gray-900")}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1 hover:text-red-800"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
