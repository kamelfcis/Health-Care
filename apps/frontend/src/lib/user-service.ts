import { api } from "./api";
import { RoleName } from "@/types";

export interface SystemUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleName;
  clinicId: string | null;
  clinicName: string | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

export interface SystemUsersListResult {
  data: SystemUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ListSystemUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  clinicId?: string;
  role?: string;
  deletedFilter?: "active" | "deleted" | "all";
}

export const userService = {
  async listAllSystem(params: ListSystemUsersParams = {}) {
    const res = await api.get<{ data: SystemUsersListResult }>("/users/all", {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
        search: params.search?.trim() || undefined,
        clinicId: params.clinicId || undefined,
        role: params.role && params.role !== "all" ? params.role : undefined,
        deletedFilter: params.deletedFilter ?? "active"
      }
    });
    return res.data.data;
  },

  async deleteSystemUser(userId: string) {
    await api.delete(`/users/all/${userId}`);
  }
};
