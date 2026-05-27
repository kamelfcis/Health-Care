import { Response } from "express";
import XLSX from "xlsx";
import { procedureService } from "../services/procedure.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { AppError } from "../utils/app-error";
import { getOptionalClinicScope, getScopedClinicIdForCreate } from "../utils/tenant";

export const procedureController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req) ?? getScopedClinicIdForCreate(req);
    const data = await procedureService.list(clinicId, true);
    res.json(apiSuccess(data));
  },

  async listAll(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req) ?? getScopedClinicIdForCreate(req);
    const data = await procedureService.list(clinicId, false);
    res.json(apiSuccess(data));
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const data = await procedureService.create(clinicId, req.body);
    res.status(201).json(apiSuccess(data, "Procedure catalog item created"));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req) ?? getScopedClinicIdForCreate(req);
    const data = await procedureService.update(String(req.params.id), clinicId, req.body);
    res.json(apiSuccess(data, "Procedure catalog item updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const clinicId = getOptionalClinicScope(req) ?? getScopedClinicIdForCreate(req);
    const data = await procedureService.remove(String(req.params.id), clinicId);
    res.json(apiSuccess(data, "Procedure catalog item deleted"));
  },

  async importExcel(req: AuthenticatedRequest, res: Response) {
    const clinicId = getScopedClinicIdForCreate(req);
    const file = req.file;
    if (!file?.buffer?.length) {
      throw new AppError("Excel file is required", 400);
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new AppError("Excel sheet is empty", 400);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: ""
    });
    const normalized = rows.map((row) => ({
      name: String(row.name ?? row.procedure_name ?? row["اسم الإجراء"] ?? ""),
      default_amount: String(row.default_amount ?? row.defaultAmount ?? row["المبلغ الافتراضي"] ?? ""),
      is_active: String(row.is_active ?? row.isActive ?? row["نشط"] ?? "")
    }));

    const result = await procedureService.importRows(clinicId, normalized);
    return res.json(apiSuccess(result, "Procedures imported"));
  },

  async downloadTemplate(_req: AuthenticatedRequest, res: Response) {
    const rows = [
      { name: "Dental cleaning", default_amount: 150, is_active: true },
      { name: "X-ray", default_amount: 80, is_active: true }
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["name", "default_amount", "is_active"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "procedures");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=procedure_import_template.xlsx");
    return res.send(buffer);
  }
};
