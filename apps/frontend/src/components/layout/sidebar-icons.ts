import {
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Pill,
  Settings,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
  TrendingUp
} from "lucide-react";
import type { NavigationLink } from "@/lib/route-access";

export const SIDEBAR_ICON_BY_NAME = {
  LayoutDashboard,
  Building2,
  ClipboardList,
  UserCog,
  Stethoscope,
  Users,
  Calendar,
  Pill,
  CreditCard,
  Wallet,
  TrendingUp,
  Settings
} as const;

export type SidebarIconComponent = (typeof SIDEBAR_ICON_BY_NAME)[NavigationLink["iconName"]];

export const SIDEBAR_ICON_SIZE = 19;
export const SIDEBAR_ICON_STROKE = 1.75;
