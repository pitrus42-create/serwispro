export interface DashboardData {
  criticalAlerts: number;
  openAlerts: number;
  overdueOrders: number;
  todayOrders: {
    id: string;
    orderNumber: string;
    type: string;
    title?: string;
    client?: { name: string } | null;
    scheduledAt?: string | null;
    assignments: { user: { firstName: string; lastName: string } }[];
  }[];
  highPriorityOrders: number;
  pendingMaintenance: number;
  pendingOrders: number;
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
