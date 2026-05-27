import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

interface CatalogPayload {
  name: string;
  procedureType?: string;
  defaultAmount?: number | null;
  isActive?: boolean;
}

interface ProcedureImportRow {
  name: string;
  default_amount?: string | number | null;
  is_active?: string | number | boolean | null;
}

export const procedureService = {
  async list(clinicId: string, activeOnly = true) {
    return prisma.procedureCatalog.findMany({
      where: {
        clinicId,
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {})
      },
      orderBy: [{ name: "asc" }, { procedureType: "asc" }]
    });
  },

  async getById(id: string, clinicId: string) {
    const item = await prisma.procedureCatalog.findFirst({
      where: { id, clinicId, deletedAt: null }
    });
    if (!item) {
      throw new AppError("Procedure catalog item not found", 404);
    }
    return item;
  },

  async create(clinicId: string, payload: CatalogPayload) {
    const name = payload.name?.trim();
    const procedureType = (payload.procedureType?.trim() || name || "").trim();
    if (!name) {
      throw new AppError("Procedure name is required", 400);
    }
    const defaultAmount =
      payload.defaultAmount === null || payload.defaultAmount === undefined
        ? null
        : Number(payload.defaultAmount);
    if (defaultAmount !== null && (!Number.isFinite(defaultAmount) || defaultAmount < 0)) {
      throw new AppError("Invalid default amount", 400);
    }

    return prisma.procedureCatalog.create({
      data: {
        clinicId,
        name,
        procedureType,
        defaultAmount,
        isActive: payload.isActive ?? true
      }
    });
  },

  async update(id: string, clinicId: string, payload: Partial<CatalogPayload>) {
    await this.getById(id, clinicId);
    const nextData: {
      name?: string;
      procedureType?: string;
      defaultAmount?: number | null;
      isActive?: boolean;
    } = {};

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new AppError("Procedure name is required", 400);
      nextData.name = name;
    }
    if (payload.procedureType !== undefined) {
      const procedureType = (payload.procedureType.trim() || nextData.name || "").trim();
      if (procedureType) nextData.procedureType = procedureType;
    }
    if (payload.defaultAmount !== undefined) {
      if (payload.defaultAmount === null) {
        nextData.defaultAmount = null;
      } else {
        const defaultAmount = Number(payload.defaultAmount);
        if (!Number.isFinite(defaultAmount) || defaultAmount < 0) {
          throw new AppError("Invalid default amount", 400);
        }
        nextData.defaultAmount = defaultAmount;
      }
    }
    if (payload.isActive !== undefined) {
      nextData.isActive = payload.isActive;
    }

    return prisma.procedureCatalog.update({
      where: { id },
      data: nextData
    });
  },

  async remove(id: string, clinicId: string) {
    await this.getById(id, clinicId);
    return prisma.procedureCatalog.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });
  },

  async importRows(clinicId: string, rows: ProcedureImportRow[]) {
    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<{
      clinicId: string;
      name: string;
      procedureType: string;
      defaultAmount: number | null;
      isActive: boolean;
    }> = [];

    rows.forEach((row, index) => {
      const rowNo = index + 2;
      const name = String(row.name ?? "").trim();
      if (!name) {
        const values = [row.name, row.default_amount, row.is_active];
        const isEmpty = values.every((value) => !String(value ?? "").trim());
        if (isEmpty) return;
        errors.push({ row: rowNo, message: "name is required" });
        return;
      }

      const defaultRaw = row.default_amount;
      let defaultAmount: number | null = null;
      if (defaultRaw !== null && defaultRaw !== undefined && String(defaultRaw).trim() !== "") {
        const parsed = Number(defaultRaw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          errors.push({ row: rowNo, message: "default_amount must be a non-negative number" });
          return;
        }
        defaultAmount = parsed;
      }

      const activeRaw = String(row.is_active ?? "").trim().toLowerCase();
      const isActive =
        activeRaw === "" || activeRaw === "1" || activeRaw === "true" || activeRaw === "yes" || activeRaw === "نعم";

      validRows.push({
        clinicId,
        name,
        procedureType: name,
        defaultAmount,
        isActive: activeRaw === "" ? true : isActive
      });
    });

    if (validRows.length) {
      await prisma.procedureCatalog.createMany({ data: validRows });
    }

    return {
      inserted: validRows.length,
      skipped: Math.max(0, rows.length - validRows.length - errors.length),
      errors
    };
  }
};
