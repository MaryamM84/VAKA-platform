
"use client";

import Image from "next/image";
import Link from "next/link";

export default function WelcomePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-[var(--vaka-auth-page)] px-6 py-10"
    >
      <section className="relative w-full max-w-5xl flex flex-col items-center justify-center gap-8 md:block md:min-h-[560px]">

        {/* Welcome illustration */}
        <div className="pointer-events-none relative z-10 w-72 aspect-[7/10] shrink-0 md:absolute md:right-0 md:top-1/2 md:w-[42%] md:-translate-y-1/2">
          <Image
            src="/images/Joyful_Mid-Air_Celebration-removebg-preview%201.png"
            alt="جشن موفقیت"
            fill
            priority
            className="object-contain"
            sizes="(max-width: 768px) 288px, 42vw"
          />
        </div>

        {/* Welcome message and action */}
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center md:absolute md:left-[15%] md:top-1/2 md:w-[63%] md:-translate-y-1/2 md:gap-8">

          <h1 className="text-2xl md:text-3xl font-medium text-[var(--vaka-auth-heading)]">
            با موفقیت وارد واکا شدید
          </h1>

          <Link
            href="/employer/tasks/create"
            className="w-full rounded-full bg-[var(--vaka-primary)] py-4 md:py-5 text-2xl md:text-4xl font-bold text-white text-center shadow-[var(--vaka-shadow-floating)] transition hover:bg-[var(--vaka-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vaka-primary)]"
          >
            ایجاد تسک جدید
          </Link>

        </div>
      </section>
    </main>
  );
}
