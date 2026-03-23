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

const referralTypeValues = ["DOCTOR", "FRIEND", "CAMPAIGN", "SOCIAL_MEDIA", "SEARCH", "OTHER"] as const;
const nationalityValues = [
  "EGYPTIAN",
  "SAUDI",
  "EMIRATI",
  "KUWAITI",
  "JORDANIAN",
  "SYRIAN",
  "LEBANESE",
  "IRAQI",
  "PALESTINIAN",
  "OTHER"
] as const;
const countryValues = ["EGYPT", "SAUDI_ARABIA", "UAE", "KUWAIT", "JORDAN", "SYRIA", "LEBANON", "IRAQ", "PALESTINE", "OTHER"] as const;
const governorateValues = [
  "CAIRO",
  "GIZA",
  "ALEXANDRIA",
  "SHARKIA",
  "DAKAHLIA",
  "QALYUBIA",
  "MINYA",
  "ASYUT",
  "SOHAG",
  "LUXOR",
  "ASWAN",
  "OTHER"
] as const;
const patientSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nationalId: z.string().optional(),
  phone: z.string().min(3, "Phone is required"),
  whatsapp: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: z.preprocess((val) => (val === "" ? undefined : val), z.string().email("Invalid email").optional()),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  genderOther: z.string().optional(),
  nationality: z.enum(nationalityValues).optional(),
  nationalityOther: z.string().optional(),
  country: z.enum(countryValues).optional(),
  countryOther: z.string().optional(),
  governorate: z.enum(governorateValues).optional(),
  governorateOther: z.string().optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"]).optional(),
  maritalStatusOther: z.string().optional(),
  profession: z.enum(["ADMIN_EMPLOYEE", "FREELANCER", "DRIVER", "ENGINEER", "FACTORY_WORKER", "OTHER"]),
  professionOther: z.string().optional(),
  occupation: z.string().optional(),
  leadSource: z.enum(["FACEBOOK_AD", "GOOGLE_SEARCH", "DOCTOR_REFERRAL", "FRIEND", "OTHER"]),
  leadSourceOther: z.string().optional(),
  branch: z.string().optional(),
  specialtyCode: z.string().optional(),
  specialtyName: z.string().optional(),
  clinicName: z.string().optional(),
  doctorName: z.string().optional(),
  campaignName: z.string().optional(),
  referrerName: z.string().optional(),
  referralType: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(referralTypeValues).optional()
  ),
  referralTypeOther: z.string().optional(),
  generalNotes: z.string().optional(),
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
  if (value.gender === "OTHER" && !value.genderOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["genderOther"], message: "Gender other is required" });
  }
  if (value.nationality === "OTHER" && !value.nationalityOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nationalityOther"], message: "Nationality other is required" });
  }
  if (value.country === "OTHER" && !value.countryOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["countryOther"], message: "Country other is required" });
  }
  if (value.governorate === "OTHER" && !value.governorateOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["governorateOther"], message: "Governorate other is required" });
  }
  if (value.maritalStatus === "OTHER" && !value.maritalStatusOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maritalStatusOther"], message: "Marital status other is required" });
  }
  if (value.referralType === "OTHER" && !value.referralTypeOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referralTypeOther"], message: "Referral type other is required" });
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
      alternatePhone: initialValues?.alternatePhone ?? "",
      email: initialValues?.email ?? "",
      dateOfBirth: initialValues?.dateOfBirth ?? "",
      gender: initialValues?.gender ?? "MALE",
      genderOther: initialValues?.genderOther ?? "",
      nationality: initialValues?.nationality ?? "EGYPTIAN",
      nationalityOther: initialValues?.nationalityOther ?? "",
      country: initialValues?.country ?? "EGYPT",
      countryOther: initialValues?.countryOther ?? "",
      governorate: initialValues?.governorate ?? "CAIRO",
      governorateOther: initialValues?.governorateOther ?? "",
      maritalStatus: initialValues?.maritalStatus ?? "SINGLE",
      maritalStatusOther: initialValues?.maritalStatusOther ?? "",
      profession: initialValues?.profession ?? "ADMIN_EMPLOYEE",
      professionOther: initialValues?.professionOther ?? "",
      occupation: initialValues?.occupation ?? "",
      leadSource: initialValues?.leadSource ?? "GOOGLE_SEARCH",
      leadSourceOther: initialValues?.leadSourceOther ?? "",
      branch: initialValues?.branch ?? "",
      specialtyCode: initialValues?.specialtyCode ?? "",
      specialtyName: initialValues?.specialtyName ?? "",
      clinicName: initialValues?.clinicName ?? "",
      doctorName: initialValues?.doctorName ?? "",
      campaignName: initialValues?.campaignName ?? "",
      referrerName: initialValues?.referrerName ?? "",
      referralType: initialValues?.referralType,
      referralTypeOther: initialValues?.referralTypeOther ?? "",
      generalNotes: initialValues?.generalNotes ?? "",
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
  const gender = watch("gender");
  const nationality = watch("nationality");
  const country = watch("country");
  const governorate = watch("governorate");
  const maritalStatus = watch("maritalStatus");
  const referralType = watch("referralType");
  const profession = watch("profession");
  const leadSource = watch("leadSource");
  const specialtyCode = watch("specialtyCode");
  const createAppointmentNow = watch("createAppointmentNow");
  const appointmentSpecialtyCode = watch("appointmentSpecialtyCode");
  const clinicSpecialtiesQuery = useQuery({
    queryKey: ["patients", "form", "clinic-specialties", clinicScope ?? "mine"],
    queryFn: () => specialtyService.listMyClinicSpecialties(clinicScope),
    enabled: true
  });
  const selectedAppointmentSpecialtyName = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? [])
        .find((item) => item.specialty.code === appointmentSpecialtyCode)
        ?.specialty.name ?? "",
    [appointmentSpecialtyCode, clinicSpecialtiesQuery.data]
  );
  const selectedSpecialtyName = useMemo(
    () =>
      (clinicSpecialtiesQuery.data ?? [])
        .find((item) => item.specialty.code === specialtyCode)
        ?.specialty.name ?? "",
    [specialtyCode, clinicSpecialtiesQuery.data]
  );
  const doctorsQuery = useQuery({
    queryKey: ["patients", "form", "doctors", clinicScope ?? "mine", selectedSpecialtyName ?? "all"],
    queryFn: () => doctorService.list(clinicScope, selectedSpecialtyName || undefined),
    enabled: Boolean(specialtyCode)
  });
  const appointmentDoctorsQuery = useQuery({
    queryKey: ["patients", "form", "appointment-doctors", clinicScope ?? "mine", selectedAppointmentSpecialtyName ?? "all"],
    queryFn: () => doctorService.list(clinicScope, selectedAppointmentSpecialtyName || undefined),
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
            <label className="block text-base text-slate-600">{t("field.nationalId")} (اختياري)</label>
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
          <label className="mb-1 block text-base text-slate-600">{t("field.whatsapp")} (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("whatsapp")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">هاتف بديل (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("alternatePhone")} />
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">البريد الإلكتروني (اختياري)</label>
          <input type="email" className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("email")} />
          {errors.email ? <p className="mt-1 text-xs text-red-500">{errors.email.message}</p> : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">النوع (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("gender")}>
            <option value="MALE">ذكر</option>
            <option value="FEMALE">انثى</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">الحالة الاجتماعية (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("maritalStatus")}>
            <option value="SINGLE">اعزب</option>
            <option value="MARRIED">متزوج</option>
            <option value="DIVORCED">مطلق</option>
            <option value="WIDOWED">ارمل</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
      </div>
      {gender === "OTHER" ? (
        <div>
          <label className="mb-1 block text-base text-slate-600">النوع (أخرى)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("genderOther")} />
        </div>
      ) : null}
      {maritalStatus === "OTHER" ? (
        <div>
          <label className="mb-1 block text-base text-slate-600">الحالة الاجتماعية (أخرى)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("maritalStatusOther")} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.dateOfBirth")} (اختياري)</label>
          <input type="date" className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("dateOfBirth")} />
          <p className="mt-1 text-xs text-slate-500">Age: {liveAge ?? "-"}</p>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">{t("field.address")} (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("address")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-base text-slate-600">الجنسية (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("nationality")}>
            <option value="EGYPTIAN">مصري</option>
            <option value="SAUDI">سعودي</option>
            <option value="EMIRATI">إماراتي</option>
            <option value="KUWAITI">كويتي</option>
            <option value="JORDANIAN">أردني</option>
            <option value="SYRIAN">سوري</option>
            <option value="LEBANESE">لبناني</option>
            <option value="IRAQI">عراقي</option>
            <option value="PALESTINIAN">فلسطيني</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">الدولة (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("country")}>
            <option value="EGYPT">مصر</option>
            <option value="SAUDI_ARABIA">السعودية</option>
            <option value="UAE">الإمارات</option>
            <option value="KUWAIT">الكويت</option>
            <option value="JORDAN">الأردن</option>
            <option value="SYRIA">سوريا</option>
            <option value="LEBANON">لبنان</option>
            <option value="IRAQ">العراق</option>
            <option value="PALESTINE">فلسطين</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">المحافظة (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("governorate")}>
            <option value="CAIRO">القاهرة</option>
            <option value="GIZA">الجيزة</option>
            <option value="ALEXANDRIA">الاسكندرية</option>
            <option value="SHARKIA">الشرقية</option>
            <option value="DAKAHLIA">الدقهلية</option>
            <option value="QALYUBIA">القليوبية</option>
            <option value="MINYA">المنيا</option>
            <option value="ASYUT">أسيوط</option>
            <option value="SOHAG">سوهاج</option>
            <option value="LUXOR">الأقصر</option>
            <option value="ASWAN">أسوان</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">المهنة (نص) (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("occupation")} />
        </div>
      </div>
      {nationality === "OTHER" ? <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="الجنسية (أخرى)" {...register("nationalityOther")} /> : null}
      {country === "OTHER" ? <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="الدولة (أخرى)" {...register("countryOther")} /> : null}
      {governorate === "OTHER" ? <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="المحافظة (أخرى)" {...register("governorateOther")} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-base text-slate-600">الفرع (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("branch")} />
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">العيادة (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("clinicName")} />
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">التخصص (اختياري)</label>
          <select
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
            {...register("specialtyCode")}
            onChange={(event) => {
              const code = event.target.value;
              setValue("specialtyCode", code, { shouldDirty: true });
              const selected = (clinicSpecialtiesQuery.data ?? []).find((item) => item.specialty.code === code);
              setValue("specialtyName", selected?.specialty.nameAr ?? selected?.specialty.name ?? "", { shouldDirty: true });
              setValue("doctorName", "", { shouldDirty: true });
            }}
          >
            <option value="">اختر التخصص</option>
            {(clinicSpecialtiesQuery.data ?? []).map((item) => (
              <option key={item.id} value={item.specialty.code}>
                {item.specialty.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">اسم الطبيب (اختياري)</label>
          <select
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
            {...register("doctorName")}
          >
            <option value="">اختر الطبيب</option>
            {(doctorsQuery.data ?? []).map((doctor) => {
              const name = `${doctor.user?.firstName ?? ""} ${doctor.user?.lastName ?? ""}`.trim();
              return (
                <option key={doctor.id} value={name}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">اسم الحملة (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("campaignName")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-base text-slate-600">اسم المحول (اختياري)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("referrerName")} />
        </div>
        <div>
          <label className="mb-1 block text-base text-slate-600">نوع التحويل (اختياري)</label>
          <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 focus:border-orange-500 focus:outline-none" {...register("referralType")}>
            <option value="">—</option>
            <option value="DOCTOR">طبيب</option>
            <option value="FRIEND">صديق</option>
            <option value="CAMPAIGN">حملة</option>
            <option value="SOCIAL_MEDIA">وسائل التواصل</option>
            <option value="SEARCH">بحث</option>
            <option value="OTHER">اخرى</option>
          </select>
        </div>
      </div>
      {referralType === "OTHER" ? (
        <div>
          <label className="mb-1 block text-base text-slate-600">نوع التحويل (أخرى)</label>
          <input className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" {...register("referralTypeOther")} />
        </div>
      ) : null}
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
      <div>
        <label className="mb-1 block text-base text-slate-600">ملاحظات عامة (اختياري)</label>
        <textarea
          rows={3}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          {...register("generalNotes")}
        />
      </div>
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
                  {(appointmentDoctorsQuery.data ?? []).map((doctor) => (
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
