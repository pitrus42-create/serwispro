"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Kalendarz" },
  { href: "/orders", icon: ClipboardList, label: "Zlecenia" },
  { href: "/clients", icon: Users, label: "Klienci" },
  { href: "/templates/checklists", icon: FileText, label: "Checklisty" },
  { href: "/templates/protocols", icon: FileText, label: "Szablony protokołów" },
  { href: "/vehicles", icon: Car, label: "Pojazdy" },
  { href: "/stock", icon: Package, label: "Magazyn" },
  { href: "/analytics", icon: BarChart3, label: "Analizy" },
  { href: "/settings", icon: Settings, label: "Ustawienia", roles: ["SUPERADMIN", "ADMIN", "SZEF"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRoles = session?.user?.roles as string[] | undefined;

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
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto text-red-700" />
                  )}
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
      </div>
    </aside>
  );
}
