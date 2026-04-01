import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import BrandText from "@/components/BrandText";

export const metadata: Metadata = {
  title: { default: "WorkForce Command", template: "%s | WorkForce Command" },
  description: "Operations planning for workforce scheduling, assignments, equipment, and reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_right,_rgb(var(--surface-tint-a)/0.14),_transparent_26%),radial-gradient(circle_at_top_left,_rgb(var(--surface-tint-b)/0.12),_transparent_22%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)]">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/88 backdrop-blur">
              <div className="flex h-16 items-center justify-between px-5 lg:px-8">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Operations System</p>
                  <p className="text-sm text-slate-500"><BrandText field="tagline" /></p>
                </div>
                <div className="flex items-center gap-3">
                  <ThemeSwitcher />
                  <div className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm md:block">
                    {today}
                  </div>
                </div>
              </div>
            </header>
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
