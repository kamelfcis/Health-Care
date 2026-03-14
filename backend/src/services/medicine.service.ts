import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface ListInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: "arabicName" | "englishName" | "createdAt";
  sortOrder?: "asc" | "desc";
}

interface DeleteRangeInput {
  clinicId: string;
  from: number;
  to: number;
  search?: string;
  sortBy?: "arabicName" | "englishName" | "createdAt";
  sortOrder?: "asc" | "desc";
}

interface MedicinePayload {
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
}

interface MedicineImportRow {
  arabic_name: string;
  english_name: string;
  active_ingredient: string;
  usage_method?: string;
  specialty?: string;
  dosage_form?: string;
  concentration?: string;
  company?: string;
  warnings?: string;
  drug_interactions?: string;
}

const normalizeOptional = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next || null;
};

const buildListWhere = (clinicId: string | undefined, search: string | undefined) => {
  const tokens = (search ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    ...(clinicId ? { clinicId } : {}),
    deletedAt: null,
    ...(tokens.length
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { arabicName: { contains: token } },
              { englishName: { contains: token } },
              { activeIngredient: { contains: token } },
              { specialty: { contains: token } },
              { company: { contains: token } },
              { dosageForm: { contains: token } },
              { concentration: { contains: token } }
            ]
          }))
        }
      : {})
  };
};

export const medicineService = {
  async list(input: ListInput) {
    const orderBy = input.sortBy ?? "arabicName";
    const order = input.sortOrder ?? "asc";
    const where = buildListWhere(input.clinicId, input.search);

    const [items, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { [orderBy]: order }
      }),
      prisma.medicine.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async getById(id: string, clinicId?: string) {
    const item = await prisma.medicine.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(clinicId ? { clinicId } : {})
      }
    });
    if (!item) {
      throw new AppError("Medicine not found", 404);
    }
    return item;
  },

  async create(clinicId: string, payload: MedicinePayload) {
    const arabicName = payload.arabicName.trim();
    const englishName = payload.englishName.trim();
    const activeIngredient = payload.activeIngredient.trim();
    if (!arabicName || !englishName || !activeIngredient) {
      throw new AppError("arabicName, englishName and activeIngredient are required", 400);
    }

    return prisma.medicine.create({
      data: {
        clinicId,
        arabicName,
        englishName,
        activeIngredient,
        usageMethod: normalizeOptional(payload.usageMethod),
        specialty: normalizeOptional(payload.specialty),
        dosageForm: normalizeOptional(payload.dosageForm),
        concentration: normalizeOptional(payload.concentration),
        company: normalizeOptional(payload.company),
        warnings: normalizeOptional(payload.warnings),
        drugInteractions: normalizeOptional(payload.drugInteractions)
      }
    });
  },

  async update(id: string, clinicId: string, payload: Partial<MedicinePayload>) {
    const existing = await prisma.medicine.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true }
    });
    if (!existing) {
      throw new AppError("Medicine not found", 404);
    }

    const nextData = {
      ...(payload.arabicName !== undefined ? { arabicName: payload.arabicName.trim() } : {}),
      ...(payload.englishName !== undefined ? { englishName: payload.englishName.trim() } : {}),
      ...(payload.activeIngredient !== undefined ? { activeIngredient: payload.activeIngredient.trim() } : {}),
      ...(payload.usageMethod !== undefined ? { usageMethod: normalizeOptional(payload.usageMethod) } : {}),
      ...(payload.specialty !== undefined ? { specialty: normalizeOptional(payload.specialty) } : {}),
      ...(payload.dosageForm !== undefined ? { dosageForm: normalizeOptional(payload.dosageForm) } : {}),
      ...(payload.concentration !== undefined ? { concentration: normalizeOptional(payload.concentration) } : {}),
      ...(payload.company !== undefined ? { company: normalizeOptional(payload.company) } : {}),
      ...(payload.warnings !== undefined ? { warnings: normalizeOptional(payload.warnings) } : {}),
      ...(payload.drugInteractions !== undefined ? { drugInteractions: normalizeOptional(payload.drugInteractions) } : {})
    };

    if (nextData.arabicName !== undefined && !nextData.arabicName) {
      throw new AppError("arabicName is required", 400);
    }
    if (nextData.englishName !== undefined && !nextData.englishName) {
      throw new AppError("englishName is required", 400);
    }
    if (nextData.activeIngredient !== undefined && !nextData.activeIngredient) {
      throw new AppError("activeIngredient is required", 400);
    }

    return prisma.medicine.update({
      where: { id: existing.id },
      data: nextData
    });
  },

  async remove(id: string, clinicId: string) {
    const result = await prisma.medicine.updateMany({
      where: { id, clinicId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    if (!result.count) {
      throw new AppError("Medicine not found", 404);
    }
    return result;
  },

  async deleteRange(input: DeleteRangeInput) {
    if (input.from <= 0 || input.to <= 0 || input.from > input.to) {
      throw new AppError("Invalid range", 400);
    }

    const where = buildListWhere(input.clinicId, input.search);
    const orderBy = input.sortBy ?? "arabicName";
    const order = input.sortOrder ?? "asc";
    const total = await prisma.medicine.count({ where });

    if (total === 0) {
      return { total, matched: 0, deleted: 0 };
    }
    if (input.from > total) {
      throw new AppError("Range start exceeds filtered results", 400);
    }

    const start = input.from - 1;
    const take = input.to - input.from + 1;
    const selected = await prisma.medicine.findMany({
      where,
      skip: start,
      take,
      orderBy: { [orderBy]: order },
      select: { id: true }
    });
    const ids = selected.map((item) => item.id);
    if (!ids.length) {
      return { total, matched: 0, deleted: 0 };
    }

    const result = await prisma.medicine.updateMany({
      where: { id: { in: ids }, clinicId: input.clinicId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    return {
      total,
      matched: ids.length,
      deleted: result.count
    };
  },

  async importRows(clinicId: string, rows: MedicineImportRow[]) {
    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<MedicinePayload> = [];

    rows.forEach((row, index) => {
      const rowNo = index + 2;
      const values = [
        row.arabic_name,
        row.english_name,
        row.active_ingredient,
        row.usage_method,
        row.specialty,
        row.dosage_form,
        row.concentration,
        row.company,
        row.warnings,
        row.drug_interactions
      ];
      const isEmpty = values.every((value) => !String(value ?? "").trim());
      if (isEmpty) return;

      const arabicName = String(row.arabic_name ?? "").trim();
      const englishName = String(row.english_name ?? "").trim();
      const activeIngredient = String(row.active_ingredient ?? "").trim();

      if (!arabicName || !englishName || !activeIngredient) {
        errors.push({
          row: rowNo,
          message: "arabic_name, english_name and active_ingredient are required"
        });
        return;
      }

      validRows.push({
        arabicName,
        englishName,
        activeIngredient,
        usageMethod: String(row.usage_method ?? "").trim() || null,
        specialty: String(row.specialty ?? "").trim() || null,
        dosageForm: String(row.dosage_form ?? "").trim() || null,
        concentration: String(row.concentration ?? "").trim() || null,
        company: String(row.company ?? "").trim() || null,
        warnings: String(row.warnings ?? "").trim() || null,
        drugInteractions: String(row.drug_interactions ?? "").trim() || null
      });
    });

    if (validRows.length) {
      await prisma.medicine.createMany({
        data: validRows.map((item) => ({ ...item, clinicId }))
      });
    }

    return {
      inserted: validRows.length,
      skipped: Math.max(0, rows.length - validRows.length - errors.length),
      errors
    };
  }
};
