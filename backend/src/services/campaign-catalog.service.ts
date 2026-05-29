import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export const campaignCatalogService = {
  async listForClinic(clinicId: string) {
    return prisma.campaignCatalog.findMany({
      where: { clinicId, deletedAt: null, isActive: true },
      orderBy: [{ name: "asc" }]
    });
  },

  async manageListForClinic(clinicId: string) {
    return prisma.campaignCatalog.findMany({
      where: { clinicId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
  },

  async createForClinic(
    clinicId: string,
    data: { name: string; nameAr: string; isActive?: boolean }
  ) {
    const name = data.name.trim();
    if (!name) throw new AppError("Name is required", 400);
    const duplicate = await prisma.campaignCatalog.findFirst({
      where: { clinicId, name, deletedAt: null },
      select: { id: true }
    });
    if (duplicate) {
      throw new AppError("Campaign name already exists for this clinic", 409);
    }
    return prisma.campaignCatalog.create({
      data: {
        clinicId,
        name,
        nameAr: data.nameAr.trim(),
        isActive: data.isActive ?? true
      }
    });
  },

  async updateForClinic(
    clinicId: string,
    id: string,
    data: {
      name?: string;
      nameAr?: string;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.campaignCatalog.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true }
    });
    if (!existing) throw new AppError("Campaign not found", 404);

    if (data.name !== undefined) {
      const nextName = data.name.trim();
      if (!nextName) throw new AppError("Name is required", 400);
      const duplicate = await prisma.campaignCatalog.findFirst({
        where: { clinicId, name: nextName, deletedAt: null, NOT: { id } },
        select: { id: true }
      });
      if (duplicate) {
        throw new AppError("Campaign name already exists for this clinic", 409);
      }
    }

    return prisma.campaignCatalog.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.nameAr !== undefined ? { nameAr: data.nameAr.trim() } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });
  },

  async deleteForClinic(clinicId: string, id: string) {
    const existing = await prisma.campaignCatalog.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true }
    });
    if (!existing) throw new AppError("Campaign not found", 404);

    const patientUse = await prisma.patient.count({
      where: { clinicId, campaignId: existing.id, deletedAt: null }
    });
    if (patientUse > 0) {
      throw new AppError("Cannot delete campaign linked to patients", 400);
    }

    await prisma.campaignCatalog.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });
    return { count: 1 };
  },

  async assertCampaignAllowed(clinicId: string, campaignId: string) {
    const campaign = await prisma.campaignCatalog.findFirst({
      where: { id: campaignId, clinicId, deletedAt: null, isActive: true },
      select: { id: true }
    });
    if (!campaign) {
      throw new AppError("Invalid campaign", 400);
    }
    return campaign.id;
  }
};
