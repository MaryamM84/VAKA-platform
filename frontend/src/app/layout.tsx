
import type { Metadata } from "next";
import { Suspense } from "react";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import SiteHeaderGate from "@/components/layout/SiteHeaderGate";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "واکا | VAKA",
  description: "پلتفرم واگذاری و انجام کارهای کوتاه‌مدت",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.className} antialiased`}>
        <Suspense fallback={null}>
          <SiteHeaderGate />
        </Suspense>

        {children}
      </body>
    </html>
  );
}
