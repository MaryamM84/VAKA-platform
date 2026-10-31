"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";

// Login and registration use full-screen layouts without the public site header.
const HEADERLESS_ROUTES = ["/login", "/register", "/signup"];

export default function SiteHeaderGate() {
  const pathname = usePathname();
  const hideHeader = HEADERLESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return hideHeader ? null : <SiteHeader />;
}
