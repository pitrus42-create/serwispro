"use client";

import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-20">
        {/* Mobile: Logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-red-800 rounded-md flex items-center justify-center">
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

        {/* Avatar mobile — otwiera menu użytkownika */}
        <button
          className="md:hidden"
          onClick={() => setUserMenuOpen(true)}
          aria-label="Menu użytkownika"
        >
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-red-100 text-red-900 text-xs">
              {session?.user
                ? getInitials(session.user.firstName, session.user.lastName)
                : "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Mobile user menu */}
      <Sheet open={userMenuOpen} onOpenChange={setUserMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>Konto</SheetTitle>
          </SheetHeader>

          {session?.user && (
            <div className="flex items-center gap-3 mb-6">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-red-100 text-red-900 font-semibold">
                  {getInitials(session.user.firstName, session.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-900">
                  {session.user.firstName} {session.user.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  {session.user.email ?? ""}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700"
              onClick={() => { setUserMenuOpen(false); window.location.href = "/profile"; }}
            >
              <User className="h-4 w-4" />
              Mój profil
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Wyloguj się
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
