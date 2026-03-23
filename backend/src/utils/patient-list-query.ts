import { Request } from "express";
import { LeadSource } from "@prisma/client";
import { getPagination } from "./http";

const str = (req: Request, key: string) => {
  const v = req.query[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export const parsePatientListQuery = (req: Request) => {
  const { page, pageSize, search } = getPagination(req);
  const ls = str(req, "leadSource");
  const leadSource =
    ls && (Object.values(LeadSource) as string[]).includes(ls) ? (ls as LeadSource) : undefined;
  const fn = str(req, "fileNumber");
  let fileNumber: number | undefined;
  if (fn) {
    const n = parseInt(fn, 10);
    if (!Number.isNaN(n)) fileNumber = n;
  }
  return {
    page,
    pageSize,
    search,
    fullName: str(req, "fullName"),
    phone: str(req, "phone"),
    clinicName: str(req, "clinicName"),
    leadSource,
    specialtyCode: str(req, "specialtyCode"),
    specialtyName: str(req, "specialtyName"),
    campaignName: str(req, "campaignName"),
    governorate: str(req, "governorate"),
    maritalStatus: str(req, "maritalStatus"),
    doctorName: str(req, "doctorName"),
    createdFrom: str(req, "createdFrom"),
    createdTo: str(req, "createdTo"),
    firstVisitFrom: str(req, "firstVisitFrom"),
    firstVisitTo: str(req, "firstVisitTo"),
    fileNumber
  };
};

export const patientListCacheKeySuffix = (q: ReturnType<typeof parsePatientListQuery>) =>
  [
    q.page,
    q.pageSize,
    q.search ?? "",
    q.fullName ?? "",
    q.phone ?? "",
    q.clinicName ?? "",
    q.leadSource ?? "",
    q.specialtyCode ?? "",
    q.specialtyName ?? "",
    q.campaignName ?? "",
    q.governorate ?? "",
    q.maritalStatus ?? "",
    q.doctorName ?? "",
    q.createdFrom ?? "",
    q.createdTo ?? "",
    q.firstVisitFrom ?? "",
    q.firstVisitTo ?? "",
    q.fileNumber ?? ""
  ].join("::");
