"use client";

import { Bell, LogOut, User, ClipboardList, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  CCTV: "Monitoring CCTV", ALARM: "Alarm", BRAMA: "Automatyka bramowa",
  DOMOFON: "Domofon", SIEC: "Sieć LAN/Wi-Fi", AWARIA: "Awaria",
  KONSERWACJA: "Konserwacja", MODERNIZACJA: "Modernizacja", INNE: "Inne",
};

interface RecentInquiry {
  id: string;
  inquiryNumber: string;
  contactName: string;
  serviceType: string;
  createdAt: string;
}

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ["inquiries-count"],
    queryFn: async () => {
      const res = await fetch("/api/inquiries/count");
      if (!res.ok) return { active: 0, new: 0, toQuote: 0, waitingDecision: 0 };
      return res.json() as Promise<{ active: number; new: number; toQuote: number; waitingDecision: number }>;
    },
    refetchInterval: 60_000,
    enabled: !!session,
  });

  const newCount = countData?.new ?? 0;

  const { data: recentData } = useQuery({
    queryKey: ["inquiries-recent-new"],
    queryFn: async () => {
      const res = await fetch("/api/inquiries?status=NOWE&limit=5&page=1");
      if (!res.ok) return { data: [] };
      return res.json() as Promise<{ data: RecentInquiry[] }>;
    },
    enabled: inquiryOpen && !!session,
    staleTime: 30_000,
  });

  const recentInquiries = recentData?.data ?? [];

  return (
    <>
      <header className="h-14 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 sticky top-0 z-20">
        {/* Mobile: Logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-red-800 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">SP</span>
          </div>
        </div>

        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate md:block hidden">
          {title}
        </h1>
        <div className="flex-1 md:hidden" />

        {/* Inquiry icon */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setInquiryOpen(true)}
          title="Nowe zapytania ofertowe"
        >
          <ClipboardList className="w-5 h-5 text-gray-600" />
          {newCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-700 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </Button>

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
        <button
          className="md:hidden"
          onClick={() => setUserMenuOpen(true)}
          aria-label="Menu użytkownika"
        >
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-red-100 text-red-900 text-xs">
              {session?.user ? getInitials(session.user.firstName, session.user.lastName) : "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Inquiry Sheet */}
      <Sheet open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <SheetContent side="right" className="w-full sm:w-[380px] flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4 text-red-800" />
              Nowe zapytania ofertowe
              {newCount > 0 && (
                <span className="bg-red-700 text-white text-xs rounded-full px-1.5 py-0.5 font-bold ml-1">
                  {newCount}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {recentInquiries.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Brak nowych zapytań</p>
              </div>
            ) : (
              recentInquiries.map((inq) => (
                <button
                  key={inq.id}
                  onClick={() => { setInquiryOpen(false); router.push(`/inquiries/${inq.id}`); }}
                  className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-red-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-gray-400">{inq.inquiryNumber}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(inq.createdAt), "d MMM, HH:mm", { locale: pl })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{inq.contactName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{SERVICE_TYPE_LABELS[inq.serviceType] ?? inq.serviceType}</p>
                </button>
              ))
            )}
          </div>

          <div className="border-t p-3 shrink-0">
            <button
              onClick={() => { setInquiryOpen(false); router.push("/inquiries"); }}
              className="w-full text-center text-sm text-red-800 hover:text-red-900 font-medium py-2 hover:bg-red-50 rounded-lg transition-colors"
            >
              Zobacz wszystkie zapytania →
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
                <p className="font-semibold text-gray-900">{session.user.firstName} {session.user.lastName}</p>
                <p className="text-sm text-gray-500">{session.user.email ?? ""}</p>
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
