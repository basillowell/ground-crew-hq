"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import BrandText from "@/components/BrandText";

const NAV = [
  {
    href: "/",
    label: "Command Center",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M3.5 3A1.5 1.5 0 002 4.5v4A1.5 1.5 0 003.5 10h4A1.5 1.5 0 009 8.5v-4A1.5 1.5 0 007.5 3h-4zM12.5 3A1.5 1.5 0 0011 4.5v1A1.5 1.5 0 0012.5 7h4A1.5 1.5 0 0018 5.5v-1A1.5 1.5 0 0016.5 3h-4zM12.5 10A1.5 1.5 0 0011 11.5v4a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5v-4a1.5 1.5 0 00-1.5-1.5h-4zM3.5 13A1.5 1.5 0 002 14.5v1A1.5 1.5 0 003.5 17h4A1.5 1.5 0 009 15.5v-1A1.5 1.5 0 007.5 13h-4z" />
      </svg>
    ),
  },
  {
    href: "/scheduler",
    label: "Scheduler",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/workboard",
    label: "Workboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
      </svg>
    ),
  },
  {
    href: "/breakroom",
    label: "Breakroom",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M3.5 4A1.5 1.5 0 002 5.5v7A1.5 1.5 0 003.5 14H4v2a1 1 0 102 0v-2h8v2a1 1 0 102 0v-2h.5a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0016.5 4h-13zM5 7.25A1.25 1.25 0 116.25 8.5 1.25 1.25 0 015 7.25zm8.75 0A1.25 1.25 0 1112.5 8.5a1.25 1.25 0 011.25-1.25z" />
      </svg>
    ),
  },
  {
    href: "/employees",
    label: "Employee Mgmt",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
      </svg>
    ),
  },
  {
    href: "/equipment",
    label: "Equipment",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M14.5 10a4.5 4.5 0 004.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 01-.493.11 3.01 3.01 0 01-1.618-1.616.455.455 0 01.11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 00-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 103.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.291.01z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Setup",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-900/80 bg-[linear-gradient(180deg,_#07111f_0%,_#0f172a_34%,_#111827_100%)] text-white xl:flex">
      <div className="border-b border-white/8 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(135deg,_rgb(var(--brand-400))_0%,_rgb(var(--accent-500))_100%)] text-slate-950 shadow-[0_16px_35px_-18px_rgba(15,23,42,0.65)]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 2.75a.75.75 0 00-1.5 0v4.19l-2.22 2.22a.75.75 0 101.06 1.06l2.44-2.44a.75.75 0 00.22-.53V4.75z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55"><BrandText field="workspaceLabel" /></p>
            <span className="text-sm font-bold tracking-tight text-white"><BrandText field="companyName" /></span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          <BrandText field="tagline" />
        </p>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Operations</p>
        {NAV.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/8 text-white ring-1 ring-white/10"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                  active
                    ? "bg-[linear-gradient(135deg,_rgb(var(--brand-400))_0%,_rgb(var(--accent-500))_100%)] text-slate-950 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)]"
                    : "bg-white/5 text-slate-300 group-hover:bg-white/10"
                )}
              >
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {active ? <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand-400))]" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 px-4 py-4">
        <div className="rounded-[1.4rem] border border-white/8 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daily Flow</p>
          <div className="mt-3 space-y-2.5 text-sm text-slate-200">
            {[
              "Schedule the crew",
              "Build the workboard",
              "Send the breakroom plan",
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
