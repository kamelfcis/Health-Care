import { api } from "./api";

export interface ProcedureCatalogItem {
  id: string;
  clinicId: string;
  name: string;
  procedureType: string;
  defaultAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProcedureCatalogPayload {
  name: string;
  procedureType?: string;
  defaultAmount?: number | null;
  isActive?: boolean;
}

export const procedureService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: ProcedureCatalogItem[] }>("/procedures", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async listAll(clinicId?: string) {
    const res = await api.get<{ data: ProcedureCatalogItem[] }>("/procedures/all", {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async create(payload: UpsertProcedureCatalogPayload, clinicId?: string) {
    const res = await api.post<{ data: ProcedureCatalogItem }>("/procedures", payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async update(id: string, payload: Partial<UpsertProcedureCatalogPayload>, clinicId?: string) {
    const res = await api.patch<{ data: ProcedureCatalogItem }>(`/procedures/${id}`, payload, {
      params: clinicId ? { clinicId } : undefined
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    await api.delete(`/procedures/${id}`, {
      params: clinicId ? { clinicId } : undefined
    });
  },

  async importExcel(file: File, clinicId?: string) {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post<{
      data: { inserted: number; skipped: number; errors: Array<{ row: number; message: string }> };
    }>("/procedures/import", form, {
      params: clinicId ? { clinicId } : undefined,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return {
      insertedCount: res.data.data.inserted,
      skippedCount: res.data.data.skipped,
      errors: res.data.data.errors
    };
  },

  async downloadTemplate(clinicId?: string) {
    const res = await api.get<Blob>("/procedures/import/template", {
      params: clinicId ? { clinicId } : undefined,
      responseType: "blob"
    });
    return res.data;
  }
};
