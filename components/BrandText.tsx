"use client";

import { useEffect, useState } from "react";
import { BRAND_STORAGE_KEY, DEFAULT_BRAND_PROFILE, type BrandProfile } from "@/lib/branding";

type Props = {
  field: keyof BrandProfile;
  fallback?: string;
};

export default function BrandText({ field, fallback }: Props) {
  const [value, setValue] = useState<string>(fallback ?? String(DEFAULT_BRAND_PROFILE[field]));

  useEffect(() => {
    const readProfile = () => {
      const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);
      if (!raw) {
        setValue(fallback ?? String(DEFAULT_BRAND_PROFILE[field]));
        return;
      }
      try {
        const parsed = { ...DEFAULT_BRAND_PROFILE, ...JSON.parse(raw) } as BrandProfile;
        setValue(String(parsed[field] || fallback || DEFAULT_BRAND_PROFILE[field]));
      } catch {
        setValue(fallback ?? String(DEFAULT_BRAND_PROFILE[field]));
      }
    };

    readProfile();
    window.addEventListener("wf-brand-updated", readProfile);
    return () => window.removeEventListener("wf-brand-updated", readProfile);
  }, [fallback, field]);

  return <>{value}</>;
}
