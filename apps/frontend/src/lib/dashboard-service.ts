import { api } from "./api";

export interface DashboardMetrics {
  totalPatients: number;
  appointmentsToday: number;
  activeDoctors: number;
  outstandingInvoices: number;
  totalUsers: number;
  usersCreatedThisWeek: number;
  invoicesPaidCount: number;
  invoicesPendingCount: number;
}

export const dashboardService = {
  async getMetrics(clinicId?: string) {
    const res = await api.get<{ data: DashboardMetrics }>("/dashboard/metrics", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  }
};
