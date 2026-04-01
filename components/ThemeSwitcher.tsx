"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "evergreen", label: "Evergreen" },
  { id: "marine", label: "Marine" },
  { id: "sunrise", label: "Sunrise" },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState("evergreen");

  useEffect(() => {
    const saved = window.localStorage.getItem("wf-theme");
    const nextTheme = saved && THEMES.some((item) => item.id === saved) ? saved : "evergreen";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function updateTheme(nextTheme: string) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("wf-theme", nextTheme);
  }

  return (
    <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm lg:flex">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Theme</span>
      <select
        className="bg-transparent text-sm font-medium text-slate-700 outline-none"
        value={theme}
        onChange={(event) => updateTheme(event.target.value)}
      >
        {THEMES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
