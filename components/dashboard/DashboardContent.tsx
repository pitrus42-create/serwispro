"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";
import type { DashboardData } from "./types";

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function LoadingMobile() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-2 overflow-hidden py-2">
        {[96, 80, 112, 88].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}

function LoadingDesktop() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardContent() {
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  const firstName = session?.user?.firstName ?? undefined;

  return (
    <>
      {/* Mobile layout */}
      <div className="md:hidden">
        {isLoading || !data ? (
          <LoadingMobile />
        ) : (
          <DashboardMobile data={data} firstName={firstName} />
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block">
        {isLoading || !data ? (
          <LoadingDesktop />
        ) : (
          <DashboardDesktop data={data} />
        )}
      </div>
    </>
  );
}
