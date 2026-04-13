import { billingService } from "./billing.service";
import { doctorService } from "./doctor.service";
import { patientService } from "./patient.service";

export type GlobalSearchInput = {
  q: string;
  clinicId?: string;
  permissions: string[];
  requesterRole?: string;
  requesterUserId?: string;
};

export const searchService = {
  async global(input: GlobalSearchInput) {
    const q = input.q.trim();
    if (q.length < 2) {
      return { patients: [] as const, doctors: [] as const, invoices: [] as const };
    }

    const perms = new Set(input.permissions);
    const isSuper = input.requesterRole === "SuperAdmin";

    const [patientsBlock, doctorsBlock, invoicesBlock] = await Promise.all([
      perms.has("patients.read") || isSuper
        ? patientService
            .list({
              clinicId: input.clinicId,
              page: 1,
              pageSize: 8,
              search: q,
              requesterRole: input.requesterRole,
              requesterUserId: input.requesterUserId
            })
            .then((r) =>
              r.data.map((p) => ({
                type: "patient" as const,
                id: p.id,
                title: p.fullName,
                subtitle: p.phone ?? p.whatsapp ?? "",
                href: `/patients?patientId=${encodeURIComponent(p.id)}`
              }))
            )
        : Promise.resolve([]),
      perms.has("doctors.read") || isSuper
        ? doctorService
            .list({ clinicId: input.clinicId, page: 1, pageSize: 8, search: q })
            .then((r) =>
              r.data.map((d) => ({
                type: "doctor" as const,
                id: d.id,
                title: `${d.user.firstName} ${d.user.lastName}`.trim(),
                subtitle: d.specialty,
                href: `/doctors?doctorId=${encodeURIComponent(d.id)}`
              }))
            )
        : Promise.resolve([]),
      perms.has("billing.read") || isSuper
        ? billingService
            .list({ clinicId: input.clinicId, page: 1, pageSize: 8, search: q })
            .then((r) =>
              r.data.map((inv) => {
                const withPatient = inv as typeof inv & { patient?: { fullName: string } | null };
                return {
                type: "invoice" as const,
                id: inv.id,
                title: inv.invoiceNumber,
                subtitle: withPatient.patient?.fullName ?? "",
                href: `/billing?invoiceId=${encodeURIComponent(inv.id)}&patientId=${encodeURIComponent(inv.patientId)}`
              };
              })
            )
        : Promise.resolve([])
    ]);

    return {
      patients: patientsBlock,
      doctors: doctorsBlock,
      invoices: invoicesBlock
    };
  }
};
