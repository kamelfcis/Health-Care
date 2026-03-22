import { api } from "./api";

export interface MedicineItem {
  id: string;
  arabicName: string;
  englishName: string;
  activeIngredient: string;
  usageMethod?: string | null;
  specialty?: string | null;
  dosageForm?: string | null;
  concentration?: string | null;
  company?: string | null;
  warnings?: string | null;
  drugInteractions?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MedicineListPayload {
  data: MedicineItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UpsertMedicinePayload {
  arabicName: string;
  englishName: string;
  activeIngredient: string;
  usageMethod?: string;
  specialty?: string;
  dosageForm?: string;
  concentration?: string;
  company?: string;
  warnings?: string;
  drugInteractions?: string;
}

interface DeleteRangePayload {
  from: number;
  to: number;
  search?: string;
  sortBy?: "arabicName" | "englishName" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export const medicineService = {
  async list(params: {
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: "arabicName" | "englishName" | "createdAt";
    sortOrder?: "asc" | "desc";
  }) {
    const res = await api.get<{ data: MedicineListPayload }>("/medicines", {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        sortBy: params.sortBy ?? "arabicName",
        sortOrder: params.sortOrder ?? "asc",
        ...(params.search ? { search: params.search } : {})
      }
    });
    return res.data.data;
  },

  async getById(id: string) {
    const res = await api.get<{ data: MedicineItem }>(`/medicines/${id}`);
    return res.data.data;
  },

  async create(payload: UpsertMedicinePayload) {
    const res = await api.post<{ data: MedicineItem }>("/medicines", payload);
    return res.data.data;
  },

  async update(id: string, payload: Partial<UpsertMedicinePayload>) {
    const res = await api.put<{ data: MedicineItem }>(`/medicines/${id}`, payload);
    return res.data.data;
  },

  async remove(id: string) {
    const res = await api.delete<{ data: { id: string } }>(`/medicines/${id}`);
    return res.data.data;
  },

  async deleteRange(payload: DeleteRangePayload) {
    const res = await api.post<{ data: { total: number; matched: number; deleted: number } }>(
      "/medicines/delete-range",
      payload
    );
    return res.data.data;
  },

  async importExcel(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post<{ data: { inserted: number; skipped: number; errors: Array<{ row: number; message: string }> } }>(
      "/medicines/import",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" }
      }
    );
    return {
      insertedCount: res.data.data.inserted,
      skippedCount: res.data.data.skipped,
      errors: res.data.data.errors
    };
  },

  async downloadTemplate() {
    const res = await api.get<Blob>("/medicines/import/template", {
      responseType: "blob"
    });
    return res.data;
  }
};
