"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Car,
  Package,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  FileText,
  Bell,
  BarChart3,
  FileSearch,
  BookOpen,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Kalendarz" },
  { href: "/orders", icon: ClipboardList, label: "Zlecenia" },
  { href: "/inquiries", icon: FileSearch, label: "Zapytania ofertowe" },
  { href: "/clients", icon: Users, label: "Klienci" },
  { href: "/templates/checklists", icon: FileText, label: "Checklisty" },
  { href: "/templates/protocols", icon: FileText, label: "Szablony protokołów" },
  { href: "/vehicles", icon: Car, label: "Pojazdy" },
  { href: "/stock", icon: Package, label: "Magazyn" },
  { href: "/analytics", icon: BarChart3, label: "Analizy" },
  { href: "/settings/product-catalog", icon: BookOpen, label: "Katalog produktów", roles: ["SUPERADMIN", "ADMIN", "SZEF", "MENEDZER"] },
  { href: "/settings/quote-templates", icon: FileText, label: "Szablony wycen", roles: ["SUPERADMIN", "ADMIN", "SZEF", "MENEDZER"] },
  { href: "/settings/gallery", icon: Image, label: "Galeria realizacji", roles: ["SUPERADMIN", "ADMIN", "SZEF"] },
  { href: "/settings", icon: Settings, label: "Ustawienia", roles: ["SUPERADMIN", "ADMIN", "SZEF"] },
];

const BUILD_MARKER = "quote-fix-2026-06-04-01";

export function Sidebar() {
  const pathname = usePathname();
  if (typeof window !== "undefined") {
    console.log("APP BUILD:", BUILD_MARKER);
  }
  const { data: session } = useSession();

  const userRoles = session?.user?.roles as string[] | undefined;

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

  const activeInquiries = countData?.active ?? 0;

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 h-full fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">SerwisPro</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {navItems
            .filter((item) => !item.roles || item.roles.some((r) => userRoles?.includes(r)))
            .map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const showBadge = item.href === "/inquiries" && activeInquiries > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-red-50 text-red-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {showBadge ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-700 text-white rounded-full">
                      {activeInquiries > 99 ? "99+" : activeInquiries}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3 h-3 text-red-700" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-200">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2 mb-2 rounded-lg px-1 py-1 transition-colors",
            pathname.startsWith("/profile")
              ? "bg-red-50 text-red-900"
              : "hover:bg-gray-100"
          )}
        >
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-red-100 text-red-900 text-xs">
              {session?.user
                ? getInitials(session.user.firstName, session.user.lastName)
                : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {(session?.user?.roles as string[])?.join(", ")}
            </p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 hover:text-red-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-3 h-3 mr-2" />
          Wyloguj
        </Button>
        <p className="text-[10px] text-gray-300 mt-1 text-center">Build: {BUILD_MARKER}</p>
      </div>
    </aside>
  );
}
