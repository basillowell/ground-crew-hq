"use client";

import { useEffect, useState } from "react";
import { BRAND_STORAGE_KEY, DEFAULT_BRAND_PROFILE, type BrandProfile } from "@/lib/branding";

const THEMES = [
  { id: "evergreen", label: "Evergreen" },
  { id: "marine", label: "Marine" },
  { id: "sunrise", label: "Sunrise" },
];

export default function BrandStudio() {
  const [profile, setProfile] = useState<BrandProfile>(DEFAULT_BRAND_PROFILE);
  const [theme, setTheme] = useState("evergreen");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const rawProfile = window.localStorage.getItem(BRAND_STORAGE_KEY);
    const rawTheme = window.localStorage.getItem("wf-theme");
    if (rawProfile) {
      try {
        setProfile({ ...DEFAULT_BRAND_PROFILE, ...JSON.parse(rawProfile) });
      } catch {}
    }
    if (rawTheme) {
      setTheme(rawTheme);
    }
  }, []);

  function update<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function saveProfile() {
    window.localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(profile));
    window.localStorage.setItem("wf-theme", theme);
    document.documentElement.dataset.theme = theme;
    window.dispatchEvent(new Event("wf-brand-updated"));
    setSaved(true);
  }

  function resetProfile() {
    setProfile(DEFAULT_BRAND_PROFILE);
    setTheme("evergreen");
    setSaved(false);
  }

  return (
    <div className="workboard-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Brand Studio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Make the system fit each company or client.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            These settings let an admin shape the app’s identity and workflow language without changing code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Saved</span> : null}
          <button onClick={resetProfile} className="btn-secondary text-xs">Reset</button>
          <button onClick={saveProfile} className="btn-primary text-xs">Save Branding</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={profile.companyName} onChange={(e) => update("companyName", e.target.value)} />
          </div>
          <div>
            <label className="label">Workspace Label</label>
            <input className="input" value={profile.workspaceLabel} onChange={(e) => update("workspaceLabel", e.target.value)} />
          </div>
          <div>
            <label className="label">Command Label</label>
            <input className="input" value={profile.commandLabel} onChange={(e) => update("commandLabel", e.target.value)} />
          </div>
          <div>
            <label className="label">Client Or Property</label>
            <input className="input" value={profile.clientLabel} onChange={(e) => update("clientLabel", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Main Tagline</label>
            <input className="input" value={profile.tagline} onChange={(e) => update("tagline", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Scheduler Focus</label>
            <textarea className="input min-h-24 resize-y" value={profile.schedulerFocus} onChange={(e) => update("schedulerFocus", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Breakroom Focus</label>
            <textarea className="input min-h-24 resize-y" value={profile.breakroomFocus} onChange={(e) => update("breakroomFocus", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Theme Preset</label>
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Live Preview</p>
          <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_rgb(var(--brand-700))_34%,_rgb(var(--brand-600))_66%,_rgb(var(--accent-500))_100%)] p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">{profile.workspaceLabel}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{profile.companyName}</h3>
            <p className="mt-2 text-sm text-white/80">{profile.tagline}</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Scheduler</p>
                <p className="mt-1 text-sm">{profile.schedulerFocus}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Breakroom</p>
                <p className="mt-1 text-sm">{profile.breakroomFocus}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Client</p>
                <p className="mt-1 text-sm">{profile.clientLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
