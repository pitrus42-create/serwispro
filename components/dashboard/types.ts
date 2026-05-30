type OrderSummary = {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  title?: string;
  estimatedDuration?: string | null;
  client?: { name: string } | null;
  location?: { address: string | null; city: string | null } | null;
  scheduledAt?: string | null;
  assignments: { user: { firstName: string; lastName: string } }[];
};

export interface DashboardData {
  criticalAlerts: number;
  openAlerts: number;
  overdueOrders: number;
  todayOrders: OrderSummary[];
  overdueOrdersList: OrderSummary[];
  pendingMaintenance: number;
  waitingOrders: number;
  unsettledOrders: number;
  todaySimpleTasks: {
    id: string;
    title: string;
    description?: string | null;
    assignedUser?: { id: string; firstName: string; lastName: string } | null;
  }[];
  recentActivity: {
    id: string;
    action: string;
    createdAt: string;
    user?: { firstName: string; lastName: string } | null;
    order?: { orderNumber: string; type: string } | null;
  }[];
}
