"use client";

import { usePathname } from "next/navigation";
import { useAdminAccess } from "@/components/admin/AdminAccess";
import AdminHeader from "@/components/admin/AdminHeader";
import SiteHeader from "./SiteHeader";

// Login and registration use full-screen layouts without the public site header.
const HEADERLESS_ROUTES = ["/login", "/register", "/signup"];

export default function SiteHeaderGate() {
  const pathname = usePathname();
  const hideHeader = HEADERLESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const { access } = useAdminAccess();
  return hideHeader ? null : access === "allowed" ? <AdminHeader /> : <SiteHeader />;
}
