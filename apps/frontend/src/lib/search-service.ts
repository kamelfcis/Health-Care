import { api } from "./api";

export type GlobalSearchHit =
  | { type: "patient"; id: string; title: string; subtitle: string; href: string }
  | { type: "doctor"; id: string; title: string; subtitle: string; href: string }
  | { type: "invoice"; id: string; title: string; subtitle: string; href: string };

export interface GlobalSearchResult {
  patients: GlobalSearchHit[];
  doctors: GlobalSearchHit[];
  invoices: GlobalSearchHit[];
}

export const searchService = {
  async global(q: string, clinicId?: string) {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      return { patients: [], doctors: [], invoices: [] } satisfies GlobalSearchResult;
    }
    const res = await api.get<{ data: GlobalSearchResult }>("/search", {
      params: { q: trimmed, ...(clinicId ? { clinicId } : {}) }
    });
    return res.data.data;
  }
};
