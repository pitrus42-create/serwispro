"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-20">
        {/* Mobile: Logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">SP</span>
          </div>
        </div>

        <h1 className="text-base font-semibold text-gray-900 flex-1 truncate md:block hidden">
          {title}
        </h1>
        <div className="flex-1 md:hidden" />

        {/* Notifications bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setNotifOpen(true)}
        >
          <Bell className="w-5 h-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>

        {/* Avatar mobile */}
        <Avatar className="w-8 h-8 md:hidden">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
            {session?.user
              ? getInitials(session.user.firstName, session.user.lastName)
              : "?"}
          </AvatarFallback>
        </Avatar>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
