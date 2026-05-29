import { api } from "./api";

export interface CampaignCatalogItem {
  id: string;
  clinicId: string;
  name: string;
  nameAr: string;
  isActive: boolean;
}

export interface CampaignCatalogPayload {
  name: string;
  nameAr: string;
  isActive?: boolean;
}

function clinicParams(clinicId?: string) {
  return clinicId ? { clinicId } : undefined;
}

export const campaignCatalogService = {
  async list(clinicId?: string) {
    const res = await api.get<{ data: CampaignCatalogItem[] }>("/campaigns", {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async manageList(clinicId?: string) {
    const res = await api.get<{ data: CampaignCatalogItem[] }>("/campaigns/manage", {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async create(payload: CampaignCatalogPayload, clinicId?: string) {
    const res = await api.post<{ data: CampaignCatalogItem }>("/campaigns", payload, {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async update(id: string, payload: Partial<CampaignCatalogPayload>, clinicId?: string) {
    const res = await api.patch<{ data: CampaignCatalogItem }>(`/campaigns/${id}`, payload, {
      params: clinicParams(clinicId)
    });
    return res.data.data;
  },

  async remove(id: string, clinicId?: string) {
    await api.delete(`/campaigns/${id}`, {
      params: clinicParams(clinicId)
    });
  }
};
