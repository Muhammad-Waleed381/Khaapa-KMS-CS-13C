import type { IconName } from "@/components/icons";

export const NAV: { href: string; label: string; icon: IconName; admin?: boolean }[] = [
  { href: "/stats", label: "Dashboard", icon: "stats", admin: true },
  { href: "/pos", label: "Counter", icon: "counter" },
  { href: "/items", label: "Items", icon: "items" },
  { href: "/sales", label: "Sales", icon: "sales" },
  { href: "/orders", label: "Pre-orders", icon: "orders" },
  { href: "/schedule", label: "Schedule", icon: "schedule" },
  { href: "/shifts", label: "Shifts", icon: "shifts" },
  { href: "/contribution", label: "Contribution", icon: "contribution" },
  { href: "/report", label: "Day report", icon: "report" },
  { href: "/shares", label: "My shares", icon: "shares" },
  { href: "/shares/manage", label: "Manage shares", icon: "shares", admin: true },
  { href: "/activity", label: "Activity", icon: "activity" },
  { href: "/team", label: "Team", icon: "team", admin: true },
  { href: "/settings", label: "Settings", icon: "settings", admin: true },
];
