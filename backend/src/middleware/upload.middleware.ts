import fs from "fs";
import path from "path";
import multer from "multer";
import { AppError } from "../utils/app-error";

const uploadBaseDir = path.resolve(__dirname, "..", "..", "uploads", "clinic-images");
fs.mkdirSync(uploadBaseDir, { recursive: true });
const patientExamUploadDir = path.resolve(__dirname, "..", "..", "uploads", "patient-exams");
fs.mkdirSync(patientExamUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadBaseDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

export const uploadClinicImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError("Only image uploads are allowed", 400));
      return;
    }
    cb(null, true);
  }
});

const patientExamStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, patientExamUploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

export const uploadPatientExamAttachments = multer({
  storage: patientExamStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
      cb(new AppError("Only image and PDF uploads are allowed", 400));
      return;
    }
    cb(null, true);
  }
});

export const uploadMedicineImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const isXlsxMime =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/octet-stream";
    if (!fileName.endsWith(".xlsx") || !isXlsxMime) {
      cb(new AppError("Only .xlsx uploads are allowed", 400));
      return;
    }
    cb(null, true);
  }
});
