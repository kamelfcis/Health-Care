import { api } from "./api";
import { RoleDefinition, RoleName } from "@/types";

interface ClinicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  role: RoleName;
  permissions: string[];
  createdAt?: string;
}

interface CreateClinicUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
}

interface CreateRolePayload {
  name: string;
  permissionKeys: string[];
}

interface UpdateRolePermissionsPayload {
  permissionKeys: string[];
}

interface PermissionDefinition {
  id: string;
  key: string;
  label: string;
  category: string;
}

export const adminService = {
  async listPermissions() {
    const res = await api.get<{ data: PermissionDefinition[] }>("/admin/permissions");
    return res.data.data;
  },

  async listRoles() {
    const res = await api.get<{ data: RoleDefinition[] }>("/admin/roles");
    return res.data.data;
  },

  async createRole(payload: CreateRolePayload) {
    const res = await api.post<{ data: RoleDefinition }>("/admin/roles", payload);
    return res.data.data;
  },

  async updateRolePermissions(roleId: string, payload: UpdateRolePermissionsPayload) {
    const res = await api.patch<{ data: RoleDefinition }>(`/admin/roles/${roleId}/permissions`, payload);
    return res.data.data;
  },

  async deleteRole(roleId: string) {
    await api.delete(`/admin/roles/${roleId}`);
  },

  async listUsers() {
    const res = await api.get<{ data: ClinicUser[] }>("/admin/users");
    return res.data.data;
  },

  async createUser(payload: CreateClinicUserPayload) {
    const res = await api.post<{ data: ClinicUser }>("/admin/users", payload);
    return res.data.data;
  },

  async updateUserRole(userId: string, roleId: string) {
    const res = await api.patch<{ data: ClinicUser }>(`/admin/users/${userId}/role`, { roleId });
    return res.data.data;
  },

  async deleteUser(userId: string) {
    await api.delete(`/admin/users/${userId}`);
  }
};
