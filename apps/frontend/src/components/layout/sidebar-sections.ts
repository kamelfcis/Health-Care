export type SidebarSectionId = "overview" | "care" | "finance" | "admin";

export const SIDEBAR_SECTION_ORDER: SidebarSectionId[] = ["overview", "care", "finance", "admin"];

export const SIDEBAR_SECTION_LABEL_KEYS: Record<SidebarSectionId, string> = {
  overview: "nav.sectionOverview",
  care: "nav.sectionCare",
  finance: "nav.sectionFinance",
  admin: "nav.sectionAdmin"
};

const HREF_TO_SECTION: Record<string, SidebarSectionId> = {
  "/dashboard": "overview",
  "/clinics": "overview",
  "/doctors": "care",
  "/patients": "care",
  "/appointments": "care",
  "/pharmacy": "care",
  "/billing": "finance",
  "/payments": "finance",
  "/finance": "finance",
  "/specialties": "admin",
  "/users": "admin",
  "/dashboard/leads": "admin",
  "/settings": "admin"
};

export function getSidebarSectionForHref(href: string): SidebarSectionId {
  return HREF_TO_SECTION[href] ?? "overview";
}

/** Slightly wider for Arabic labels and touch targets */
export const SIDEBAR_WIDTH_EXPANDED = 272;
export const SIDEBAR_WIDTH_COLLAPSED = 76;
