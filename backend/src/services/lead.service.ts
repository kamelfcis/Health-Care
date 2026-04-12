import { LeadSource, LeadStatus, Profession } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: LeadStatus;
  leadSource?: LeadSource;
  assignedToId?: string;
  viewerRole: string;
  viewerUserId: string;
}

interface CreateLeadInput {
  clinicId: string;
  fullName: string;
  phone: string;
  whatsapp?: string;
  leadSource: LeadSource;
  notes?: string;
  assignedToId?: string;
  createdById?: string;
}

export const leadService = {
  async list(input: ListInput) {
    const normalizedSearch = input.search?.trim();
    const roleScopedAssignedTo =
      input.viewerRole === "Doctor"
        ? input.viewerUserId
        : input.viewerRole === "Receptionist"
          ? input.viewerUserId
          : input.assignedToId;

    const where = {
      ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.leadSource ? { leadSource: input.leadSource } : {}),
      ...(roleScopedAssignedTo ? { assignedToId: roleScopedAssignedTo } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { fullName: { contains: normalizedSearch, mode: "insensitive" as const } },
              { phone: { contains: normalizedSearch, mode: "insensitive" as const } },
              { whatsapp: { contains: normalizedSearch, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          followUps: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      prisma.lead.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async getById(id: string, clinicId: string, viewerRole: string, viewerUserId: string) {
    const roleScope =
      viewerRole === "Doctor"
        ? { assignedToId: viewerUserId }
        : viewerRole === "Receptionist"
          ? { createdById: viewerUserId }
          : {};
    const lead = await prisma.lead.findFirst({
      where: { id, clinicId, ...roleScope },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        followUps: {
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!lead) {
      throw new AppError("Lead not found", 404);
    }

    return lead;
  },

  create(input: CreateLeadInput) {
    return prisma.lead.create({
      data: {
        clinicId: input.clinicId,
        fullName: input.fullName,
        phone: input.phone,
        whatsapp: input.whatsapp || null,
        leadSource: input.leadSource,
        notes: input.notes || null,
        assignedToId: input.assignedToId || null,
        createdById: input.createdById || null
      }
    });
  },

  update(id: string, clinicId: string, data: Partial<CreateLeadInput>) {
    return prisma.lead.updateMany({
      where: { id, clinicId },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        whatsapp: data.whatsapp,
        leadSource: data.leadSource,
        notes: data.notes,
        assignedToId: data.assignedToId
      }
    });
  },

  changeStatus(id: string, clinicId: string, status: LeadStatus) {
    return prisma.lead.updateMany({
      where: { id, clinicId },
      data: { status }
    });
  },

  addFollowUp(input: {
    clinicId: string;
    leadId: string;
    note: string;
    followUpDate: string;
    status: LeadStatus;
    createdById: string;
  }) {
    return prisma.followUp.create({
      data: {
        leadId: input.leadId,
        note: input.note,
        followUpDate: new Date(input.followUpDate),
        status: input.status,
        createdById: input.createdById
      }
    });
  },

  async convertToPatient(input: {
    clinicId: string;
    leadId: string;
    profession: Profession;
    professionOther?: string;
    dateOfBirth?: string;
    address?: string;
  }) {
    if (input.profession === "OTHER" && !input.professionOther?.trim()) {
      throw new AppError("professionOther is required when profession is OTHER", 400);
    }

    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: input.leadId, clinicId: input.clinicId } });
      if (!lead) throw new AppError("Lead not found", 404);

      const maxAgg = await tx.patient.aggregate({
        where: { clinicId: input.clinicId, deletedAt: null },
        _max: { fileNumber: true }
      });
      const maxFromPatients = maxAgg._max.fileNumber ?? 0;
      const counterRow = await tx.clinicCounter.findUnique({
        where: { clinicId: input.clinicId },
        select: { lastPatientFileNumber: true }
      });
      const counterVal = counterRow?.lastPatientFileNumber ?? 0;
      const nextFileNumber = Math.max(maxFromPatients, counterVal) + 1;

      await tx.clinicCounter.upsert({
        where: { clinicId: input.clinicId },
        create: { clinicId: input.clinicId, lastPatientFileNumber: nextFileNumber },
        update: { lastPatientFileNumber: nextFileNumber }
      });

      const patient = await tx.patient.create({
        data: {
          clinicId: input.clinicId,
          fullName: lead.fullName,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          profession: input.profession,
          professionOther: input.profession === "OTHER" ? input.professionOther?.trim() ?? null : null,
          leadSource: lead.leadSource,
          address: input.address || null,
          fileNumber: nextFileNumber
        }
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED", convertedPatientId: patient.id }
      });

      return patient;
    });
  }
};
