import { Header } from "@/components/layout/Header";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6">
        <DashboardContent />
      </div>
    </>
  );
}
