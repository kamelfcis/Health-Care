export const SYSTEM_ROLE_NAMES = ["SuperAdmin", "ClinicAdmin"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

export interface PermissionDefinition {
  key: string;
  label: string;
  category: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: "dashboard.view", label: "View dashboard", category: "dashboard" },
  { key: "clinics.read", label: "View clinics", category: "clinics" },
  { key: "clinics.manage", label: "Manage clinics", category: "clinics" },
  { key: "users.read", label: "View users", category: "users" },
  { key: "users.manage", label: "Manage users", category: "users" },
  { key: "roles.read", label: "View roles", category: "roles" },
  { key: "roles.manage", label: "Manage roles", category: "roles" },
  { key: "doctors.read", label: "View doctors", category: "doctors" },
  { key: "doctors.manage", label: "Manage doctors", category: "doctors" },
  { key: "patients.read", label: "View patients", category: "patients" },
  { key: "patients.manage", label: "Manage patients", category: "patients" },
  { key: "appointments.read", label: "View appointments", category: "appointments" },
  { key: "appointments.manage", label: "Manage appointments", category: "appointments" },
  { key: "medical_records.read", label: "View medical records", category: "medical_records" },
  { key: "medical_records.manage", label: "Manage medical records", category: "medical_records" },
  { key: "specialty_assessments.manage", label: "Manage specialty assessments", category: "medical_records" },
  { key: "billing.read", label: "View billing", category: "billing" },
  { key: "billing.manage", label: "Manage billing", category: "billing" },
  { key: "payments.read", label: "View payments", category: "payments" },
  { key: "payments.manage", label: "Manage payments", category: "payments" },
  { key: "pharmacy.view", label: "View pharmacy", category: "pharmacy" },
  { key: "pharmacy.create", label: "Create medicines", category: "pharmacy" },
  { key: "pharmacy.edit", label: "Edit medicines", category: "pharmacy" },
  { key: "pharmacy.delete", label: "Delete medicines", category: "pharmacy" },
  { key: "pharmacy.import", label: "Import medicines", category: "pharmacy" },
  { key: "leads.read", label: "View leads", category: "leads" },
  { key: "leads.manage", label: "Manage leads", category: "leads" },
  { key: "leads.convert", label: "Convert leads to patients", category: "leads" }
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SuperAdmin: PERMISSION_CATALOG.map((item) => item.key),
  ClinicAdmin: [
    "dashboard.view",
    "users.read",
    "users.manage",
    "roles.read",
    "roles.manage",
    "doctors.read",
    "doctors.manage",
    "patients.read",
    "patients.manage",
    "appointments.read",
    "appointments.manage",
    "medical_records.read",
    "medical_records.manage",
    "specialty_assessments.manage",
    "billing.read",
    "billing.manage",
    "payments.read",
    "payments.manage",
    "pharmacy.view",
    "leads.read",
    "leads.manage",
    "leads.convert"
  ],
  Doctor: [
    "dashboard.view",
    "doctors.read",
    "patients.read",
    "appointments.read",
    "appointments.manage",
    "medical_records.read",
    "medical_records.manage",
    "specialty_assessments.manage",
    "pharmacy.view",
    "leads.read"
  ],
  Nurse: [
    "dashboard.view",
    "patients.read",
    "appointments.read",
    "appointments.manage",
    "medical_records.read",
    "medical_records.manage",
    "pharmacy.view",
    "leads.read"
  ],
  Receptionist: [
    "dashboard.view",
    "doctors.read",
    "patients.read",
    "patients.manage",
    "appointments.read",
    "appointments.manage",
    "billing.read",
    "billing.manage",
    "payments.read",
    "payments.manage",
    "pharmacy.view",
    "leads.read",
    "leads.manage"
  ],
  Sales: ["dashboard.view", "leads.read", "leads.manage"]
};
