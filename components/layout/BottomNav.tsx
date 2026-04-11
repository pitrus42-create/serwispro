"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Users,
  Zap,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canDo } from "@/lib/permissions";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const canCreateOrders = canDo(session?.user, "orders:create");

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard", alwaysGray: false },
    { href: "/orders", icon: ClipboardList, label: "Zlecenia", alwaysGray: false },
    { href: "/calendar", icon: Calendar, label: "Kalendarz", alwaysGray: false },
    { href: "/clients", icon: Users, label: "Klienci", alwaysGray: false },
    canCreateOrders
      ? { href: "/orders/new?type=AWARIA", icon: Zap, label: "Awaria", alwaysGray: false, red: true }
      : { href: "/settings", icon: Settings, label: "Ustawienia", alwaysGray: false, red: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 pb-safe">
      <ul className="flex">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href.split("?")[0]);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-1 transition-colors",
                  "red" in item && item.red
                    ? "text-red-500"
                    : isActive ? "text-blue-600" : "text-gray-500"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
