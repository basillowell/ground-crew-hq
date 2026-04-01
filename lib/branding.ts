export type BrandProfile = {
  companyName: string;
  workspaceLabel: string;
  commandLabel: string;
  tagline: string;
  clientLabel: string;
  schedulerFocus: string;
  breakroomFocus: string;
};

export const BRAND_STORAGE_KEY = "wf-brand-profile";

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  companyName: "WorkForce Command",
  workspaceLabel: "Operations Hub",
  commandLabel: "Command Center",
  tagline: "Schedule, assign, communicate, and report from one connected operating system.",
  clientLabel: "Primary Client",
  schedulerFocus: "Build the week before dispatching crews into the field.",
  breakroomFocus: "Show every crew member their top priority at a glance.",
};
