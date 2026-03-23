import { RoleName } from "@/types";

export interface RouteAccessRule {
  pattern: string;
  requiredPermissions?: string[];
  allowedRoles?: RoleName[];
}

export interface NavigationChildLink {
  href: string;
  labelKey: string;
}

export interface NavigationLink {
  href: string;
  labelKey: string;
  iconName:
    | "LayoutDashboard"
    | "Building2"
    | "ClipboardList"
    | "UserCog"
    | "Stethoscope"
    | "Users"
    | "Calendar"
    | "Pill"
    | "CreditCard"
    | "Wallet"
    | "Settings";
  requiredPermissions?: string[];
  allowedRoles?: RoleName[];
  children?: NavigationChildLink[];
  /** Visual "coming soon" badge; navigation still works */
  comingSoon?: boolean;
}

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  { pattern: "/dashboard/leads", requiredPermissions: ["leads.read"] },
  { pattern: "/dashboard", requiredPermissions: ["dashboard.view"] },
  { pattern: "/clinics", requiredPermissions: ["clinics.read"] },
  { pattern: "/specialties", allowedRoles: ["SuperAdmin"] },
  { pattern: "/users", requiredPermissions: ["users.read"] },
  { pattern: "/doctors", requiredPermissions: ["doctors.read"] },
  { pattern: "/patients", requiredPermissions: ["patients.read"] },
  { pattern: "/appointments", requiredPermissions: ["appointments.read"] },
  { pattern: "/pharmacy", requiredPermissions: ["pharmacy.view"] },
  { pattern: "/billing", requiredPermissions: ["billing.read"] },
  { pattern: "/payments", requiredPermissions: ["payments.read"] },
  { pattern: "/settings", allowedRoles: ["ClinicAdmin"] },
  { pattern: "/profile" }
];

export const NAVIGATION_LINKS: NavigationLink[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    iconName: "LayoutDashboard",
    requiredPermissions: ["dashboard.view"]
  },
  {
    href: "/clinics",
    labelKey: "nav.clinics",
    iconName: "Building2",
    requiredPermissions: ["clinics.read"]
  },
  {
    href: "/specialties",
    labelKey: "nav.specialties",
    iconName: "ClipboardList",
    allowedRoles: ["SuperAdmin"],
    children: [
      { href: "/specialties/templates", labelKey: "nav.specialtiesTemplates" },
      { href: "/specialties/rules", labelKey: "nav.specialtiesRulesBuilder" },
      { href: "/specialties/lookup", labelKey: "nav.specialtiesLookup" }
    ]
  },
  {
    href: "/users",
    labelKey: "nav.users",
    iconName: "UserCog",
    requiredPermissions: ["users.read"]
  },
  {
    href: "/doctors",
    labelKey: "nav.doctors",
    iconName: "Stethoscope",
    requiredPermissions: ["doctors.read"]
  },
  {
    href: "/patients",
    labelKey: "nav.patients",
    iconName: "Users",
    requiredPermissions: ["patients.read"]
  },
  {
    href: "/appointments",
    labelKey: "nav.appointments",
    iconName: "Calendar",
    requiredPermissions: ["appointments.read"]
  },
  {
    href: "/pharmacy",
    labelKey: "nav.pharmacy",
    iconName: "Pill",
    requiredPermissions: ["pharmacy.view"]
  },
  {
    href: "/billing",
    labelKey: "nav.billing",
    iconName: "CreditCard",
    requiredPermissions: ["billing.read"],
    comingSoon: true
  },
  {
    href: "/payments",
    labelKey: "nav.payments",
    iconName: "Wallet",
    requiredPermissions: ["payments.read"],
    comingSoon: true
  },
  {
    href: "/dashboard/leads",
    labelKey: "nav.leads",
    iconName: "ClipboardList",
    requiredPermissions: ["leads.read"],
    comingSoon: true
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    iconName: "Settings",
    allowedRoles: ["ClinicAdmin"]
  }
];

const normalizePath = (value: string) => {
  if (!value) return "/";
  return value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value;
};

const isPathMatch = (pathname: string, pattern: string) => {
  const normalizedPath = normalizePath(pathname);
  const normalizedPattern = normalizePath(pattern);
  return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
};

export const getRouteAccessForPath = (pathname: string): RouteAccessRule | null => {
  const normalizedPath = normalizePath(pathname);
  return ROUTE_ACCESS_RULES.find((rule) => isPathMatch(normalizedPath, rule.pattern)) ?? null;
};
