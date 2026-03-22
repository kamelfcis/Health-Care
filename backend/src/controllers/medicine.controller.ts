import type { Response } from "express";
import XLSX from "xlsx";
import { medicineService } from "../services/medicine.service";
import { apiSuccess } from "../utils/api-response";
import { AuthenticatedRequest } from "../types/auth";
import { buildCacheKey, getOrSetCache, invalidateCacheByPrefix } from "../utils/response-cache";
import { AppError } from "../utils/app-error";

const MEDICINES_CACHE_PREFIX = buildCacheKey("medicines");

export const medicineController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const sortByRaw = String(req.query.sortBy ?? "arabicName");
    const sortOrderRaw = String(req.query.sortOrder ?? "asc").toLowerCase();
    const sortBy = ["arabicName", "englishName", "createdAt"].includes(sortByRaw)
      ? (sortByRaw as "arabicName" | "englishName" | "createdAt")
      : "arabicName";
    const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const result = await getOrSetCache(
      buildCacheKey(MEDICINES_CACHE_PREFIX, "list", page, pageSize, search ?? "", sortBy, sortOrder),
      45_000,
      () =>
        medicineService.list({
          page,
          pageSize,
          sortBy,
          sortOrder,
          search
        })
    );
    return res.json(apiSuccess(result));
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const item = await medicineService.getById(String(req.params.id));
    return res.json(apiSuccess(item));
  },

  async create(_req: AuthenticatedRequest, res: Response) {
    const item = await medicineService.create(_req.body);
    invalidateCacheByPrefix(MEDICINES_CACHE_PREFIX);
    return res.status(201).json(apiSuccess(item, "Medicine created"));
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const item = await medicineService.update(String(req.params.id), req.body);
    invalidateCacheByPrefix(MEDICINES_CACHE_PREFIX);
    return res.json(apiSuccess(item, "Medicine updated"));
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await medicineService.remove(String(req.params.id));
    invalidateCacheByPrefix(MEDICINES_CACHE_PREFIX);
    return res.json(apiSuccess({ id: String(req.params.id) }, "Medicine deleted"));
  },

  async deleteRange(req: AuthenticatedRequest, res: Response) {
    const from = Number(req.body.from);
    const to = Number(req.body.to);
    const sortByRaw = String(req.body.sortBy ?? "arabicName");
    const sortOrderRaw = String(req.body.sortOrder ?? "asc").toLowerCase();
    const sortBy = ["arabicName", "englishName", "createdAt"].includes(sortByRaw)
      ? (sortByRaw as "arabicName" | "englishName" | "createdAt")
      : "arabicName";
    const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
    const search = typeof req.body.search === "string" ? req.body.search : undefined;

    const result = await medicineService.deleteRange({
      from,
      to,
      search,
      sortBy,
      sortOrder
    });

    invalidateCacheByPrefix(MEDICINES_CACHE_PREFIX);
    return res.json(apiSuccess(result, "Medicine range deleted"));
  },

  async importExcel(req: AuthenticatedRequest, res: Response) {
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
      arabic_name: String(row.arabic_name ?? row.arabicName ?? ""),
      english_name: String(row.english_name ?? row.englishName ?? ""),
      active_ingredient: String(row.active_ingredient ?? row.activeIngredient ?? ""),
      usage_method: String(row.usage_method ?? row.usageMethod ?? ""),
      specialty: String(row.specialty ?? ""),
      dosage_form: String(row.dosage_form ?? row.dosageForm ?? ""),
      concentration: String(row.concentration ?? ""),
      company: String(row.company ?? ""),
      warnings: String(row.warnings ?? ""),
      drug_interactions: String(row.drug_interactions ?? row.drugInteractions ?? "")
    }));

    const result = await medicineService.importRows(normalized);
    invalidateCacheByPrefix(MEDICINES_CACHE_PREFIX);
    return res.json(apiSuccess(result, "Medicines imported"));
  },

  async downloadTemplate(_req: AuthenticatedRequest, res: Response) {
    const rows = [
      {
        arabic_name: "باراسيتامول",
        english_name: "Paracetamol",
        active_ingredient: "Acetaminophen",
        usage_method: "قرص كل 8 ساعات",
        specialty: "عام",
        dosage_form: "Tablets",
        concentration: "500mg",
        company: "Pfizer",
        warnings: "لا يستخدم بجرعات عالية",
        drug_interactions: "يتفاعل مع الكحول"
      },
      {
        arabic_name: "أموكسيسيلين",
        english_name: "Amoxicillin",
        active_ingredient: "Amoxicillin",
        usage_method: "كبسولة كل 12 ساعة",
        specialty: "بكتيريا",
        dosage_form: "Capsules",
        concentration: "500mg",
        company: "GSK",
        warnings: "حساسية البنسلين",
        drug_interactions: "يتفاعل مع Methotrexate"
      },
      {
        arabic_name: "إيبوبروفين",
        english_name: "Ibuprofen",
        active_ingredient: "Ibuprofen",
        usage_method: "قرص بعد الأكل",
        specialty: "مسكن ألم",
        dosage_form: "Tablets",
        concentration: "400mg",
        company: "Abbott",
        warnings: "قرحة المعدة",
        drug_interactions: "يتفاعل مع Aspirin"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        "arabic_name",
        "english_name",
        "active_ingredient",
        "usage_method",
        "specialty",
        "dosage_form",
        "concentration",
        "company",
        "warnings",
        "drug_interactions"
      ]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "medicines");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=medicine_import_template.xlsx");
    return res.send(buffer);
  }
};
