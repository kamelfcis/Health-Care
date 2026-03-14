"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, Plus } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { doctorService } from "@/lib/doctor-service";
import { specialtyService, VisitEntryType } from "@/lib/specialty-service";

const patientSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nationalId: z.string().optional(),
  phone: z.string().min(3, "Phone is required"),
  whatsapp: z.string().optional(),
  dateOfBirth: z.string().optional(),
  profession: z.enum(["ADMIN_EMPLOYEE", "FREELANCER", "DRIVER", "ENGINEER", "FACTORY_WORKER", "OTHER"]),
  professionOther: z.string().optional(),
  leadSource: z.enum(["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"]),
  leadSourceOther: z.string().optional(),
  address: z.string().optional(),
  createAppointmentNow: z.boolean().optional(),
  appointmentSpecialtyCode: z.string().optional(),
  appointmentDoctorId: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  appointmentEntryType: z.enum(["EXAM", "CONSULTATION"]).optional(),
  appointmentStatus: z.enum(["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  appointmentReason: z.string().optional(),
  appointmentNotes: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.nationalId?.trim() && !/^\d{14}$/.test(value.nationalId.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nationalId"],
      message: "National ID must be exactly 14 digits"
    });
  }
  if (value.profession === "OTHER" && !value.professionOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["professionOther"],
      message: "Profession other is required when profession is OTHER"
    });
  }
  if (value.leadSource === "OTHER" && !value.leadSourceOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leadSourceOther"],
      message: "Lead source other is required when lead source is OTHER"
    });
  }
  if (value.createAppointmentNow) {
    if (!value.appointmentSpecialtyCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointmentSpecialtyCode"],
        message: "Specialty is required"
      });
    }
    if (!value.appointmentDoctorId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointmentDoctorId"],
        message: "Doctor is required"
      });
    }
    if (!value.appointmentDate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointmentDate"],
        message: "Appointment date is required"
      });
    }
    if (!value.appointmentTime?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointmentTime"],
        message: "Appointment time is required"
      });
    }
  }
});

export type PatientFormValues = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSubmit: (values: PatientFormValues) => void;
  initialValues?: Partial<PatientFormValues>;
  submitLabel?: string;
  clinicScope?: string;
  enableAppointmentSection?: boolean;
}

export function PatientForm({ onSubmit, initialValues, submitLabel, clinicScope, enableAppointmentSection = true }: PatientFormProps) {
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      fullName: initialValues?.fullName ?? "",
      nationalId: initialValues?.nationalId ?? "",
      phone: initialValues?.phone ?? "",
      whatsapp: initialValues?.whatsapp ?? "",
      dateOfBirth: initialValues?.dateOfBirth ?? "",
      profession: initialValues?.profession ?? "ADMIN_EMPLOYEE",
      professionOther: initialValues?.professionOther ?? "",
      leadSource: initialValues?.leadSource ?? "GOOGLE_SEARCH",
      leadSourceOther: initialValues?.leadSourceOther ?? "",
      address: initialValues?.address ?? "",
      createAppointmentNow: initialValues?.createAppointmentNow ?? false,
      appointmentSpecialtyCode: initialValues?.appointmentSpecialtyCode ?? "",
      appointmentDoctorId: initialValues?.appointmentDoctorId ?? "",
      appointmentDate: initialValues?.appointmentDate ?? "",
      appointmentTime: initialValues?.appointmentTime ?? "",
      appointmentEntryType: (initialValues?.appointmentEntryType as VisitEntryType | undefined) ?? "EXAM",
      appointmentStatus: initialValues?.appointmentStatus ?? "SCHEDULED",
      appointmentReason: initialValues?.appointmentReason ?? "",
      appointmentNotes: initialValues?.appointmentNotes ?? ""
    }
  });

  const dateOfBirth = watch("dateOfBirth");
  const profession = watch("profession");
  const leadSource = watch("leadSource");
  const createAppointmentNow = watch("createAppointmentNow");
  const appointmentSpecialtyCode = watch("appointmentSpecialtyCode");
  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["patients", "form", "clinic-specialties", clinicScope ?? "mine"],
    queryFn: () => specialtyService.listMyClinicSpecialties(clinicScope),
    enabled: enableAppointmentSection
  });
  const selectedSpecialtyName = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? [])
        .find((item) => item.specialty.code === appointmentSpecialtyCode)
        ?.specialty.name ?? "",
    [appointmentSpecialtyCode, clinicSpecialtiesQuery.data]
  );
  const doctorsQuery = useQuery({
    queryKey: ["patients", "form", "doctors", clinicScope ?? "mine", selectedSpecialtyName ?? "all"],
    queryFn: () => doctorService.list(clinicScope, selectedSpecialtyName || undefined),
    enabled: enableAppointmentSection && createAppointmentNow && Boolean(appointmentSpecialtyCode)
  });
  const liveAge = (() => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  })();

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div animate={errors.fullName ? { x: [0, -4, 4, 0] } : {}}>
          <label className="mb-1 block text-base text-slate-600">{t("field.fullName")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("fullName")} />
          {errors.fullName ? <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p> : null}
        </motion.div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-base text-slate-600">{t("field.nationalId")}</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center text-slate-400 hover:text-orange-600">
                    <CircleHelp size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{t("field.nationalIdHint")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="mb-1 text-[11px] text-slate-500">{t("field.nationalIdHint")}</p>
          <input
            maxLength={14}
            inputMode="numeric"
            className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            {...register("nationalId")}
          />
          {errors.nationalId ? <p className="mt-1 text-xs text-red-500">{t("patients.nationalIdInvalid")}</p> : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.phone")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("phone")} />
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.whatsapp")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("whatsapp")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.dateOfBirth")}</label>
          <input type="date" className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("dateOfBirth")} />
          <p className="mt-1 text-xs text-slate-500">Age: {liveAge ?? "-"}</p>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.address")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("address")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-base text-slate-600">{t("field.profession")}</label>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
              onClick={() => {
                setValue("profession", "OTHER", { shouldValidate: true, shouldDirty: true });
              }}
            >
              <Plus size={12} />
              {t("common.add")}
            </button>
          </div>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("profession")}>
            <option value="ADMIN_EMPLOYEE">{t("patients.profession.ADMIN_EMPLOYEE")}</option>
            <option value="FREELANCER">{t("patients.profession.FREELANCER")}</option>
            <option value="DRIVER">{t("patients.profession.DRIVER")}</option>
            <option value="ENGINEER">{t("patients.profession.ENGINEER")}</option>
            <option value="FACTORY_WORKER">{t("patients.profession.FACTORY_WORKER")}</option>
            <option value="OTHER">{t("patients.profession.OTHER")}</option>
          </select>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-base text-slate-600">{t("field.leadSource")}</label>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
              onClick={() => {
                setValue("leadSource", "OTHER", { shouldValidate: true, shouldDirty: true });
              }}
            >
              <Plus size={12} />
              {t("common.add")}
            </button>
          </div>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("leadSource")}>
            <option value="FACEBOOK_AD">{t("patients.leadSource.FACEBOOK_AD")}</option>
            <option value="GOOGLE_SEARCH">{t("patients.leadSource.GOOGLE_SEARCH")}</option>
            <option value="DOCTOR_REFERRAL">{t("patients.leadSource.DOCTOR_REFERRAL")}</option>
            <option value="FRIEND">{t("patients.leadSource.FRIEND")}</option>
            <option value="OTHER">{t("patients.leadSource.OTHER")}</option>
          </select>
        </div>
      </div>
      {profession === "OTHER" ? (
        <motion.div animate={errors.professionOther ? { x: [0, -4, 4, 0] } : {}}>
          <label className="mb-1 block text-base text-slate-600">{t("patients.professionOther")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("professionOther")} />
          {errors.professionOther ? <p className="mt-1 text-xs text-red-500">{errors.professionOther.message}</p> : null}
        </motion.div>
      ) : null}
      {leadSource === "OTHER" ? (
        <motion.div animate={errors.leadSourceOther ? { x: [0, -4, 4, 0] } : {}}>
          <label className="mb-1 block text-base text-slate-600">{t("patients.leadSourceOther")}</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("leadSourceOther")} />
          {errors.leadSourceOther ? <p className="mt-1 text-xs text-red-500">{errors.leadSourceOther.message}</p> : null}
        </motion.div>
      ) : null}
      {enableAppointmentSection ? (
        <section className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              {...register("createAppointmentNow")}
            />
            {t("patients.appointment.addNow")}
          </label>
          {createAppointmentNow ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.specialty")}</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  {...register("appointmentSpecialtyCode")}
                >
                  <option value="">{t("appointments.chooseSpecialty")}</option>
                  {(clinicSpecialtiesQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.specialty.code}>
                      {item.specialty.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("nav.doctors")}</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  {...register("appointmentDoctorId")}
                  disabled={!appointmentSpecialtyCode}
                >
                  <option value="">{appointmentSpecialtyCode ? t("appointments.chooseDoctor") : t("appointments.chooseSpecialty")}</option>
                  {(doctorsQuery.data ?? []).map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {`${doctor.user?.firstName ?? ""} ${doctor.user?.lastName ?? ""}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.medicalFile.date")}</label>
                <input type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentDate")} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.medicalFile.time")}</label>
                <input type="time" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentTime")} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.entryType")}</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentEntryType")}>
                  <option value="EXAM">{t("appointments.entryType.exam")}</option>
                  <option value="CONSULTATION">{t("appointments.entryType.consultation")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t("field.status")}</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentStatus")}>
                  <option value="SCHEDULED">{t("status.SCHEDULED")}</option>
                  <option value="CHECKED_IN">{t("status.CHECKED_IN")}</option>
                  <option value="IN_PROGRESS">{t("status.IN_PROGRESS")}</option>
                  <option value="COMPLETED">{t("status.COMPLETED")}</option>
                  <option value="CANCELLED">{t("status.CANCELLED")}</option>
                  <option value="NO_SHOW">{t("status.NO_SHOW")}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.reason")}</label>
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentReason")} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">{t("appointments.notes")}</label>
                <textarea rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" {...register("appointmentNotes")} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <RippleButton type="submit" disabled={isSubmitting}>
        {submitLabel ?? t("common.savePatient")}
      </RippleButton>
    </form>
  );
}
