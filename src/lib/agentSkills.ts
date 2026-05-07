export type AgentSkill = {
  id: string;
  title: string;
  description: string;
  docPath: string;
  relatedPages: string[];
  recommendedCodexPromptTemplate: string;
};

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'ground-crew-agent',
    title: 'Ground Crew Master Agent',
    description: 'Master orchestration skill for scoped prompts and multi-page coordination.',
    docPath: 'docs/skills/ground-crew-agent.md',
    relatedPages: ['/app/settings', '/app/dashboard', '/app/workboard'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/ground-crew-agent.md. TASK: [one-line objective]. FILES: [exact files only]. CONSTRAINTS: no schema rename, org-scoped queries, surgical edits.',
  },
  {
    id: 'auth',
    title: 'Auth Skill',
    description: 'Guides login/session/profile hydration fixes across auth and route guards.',
    docPath: 'docs/skills/auth-skill.md',
    relatedPages: ['/', '/app/*'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/auth-skill.md. TASK: fix auth flow without bypassing Supabase security. Inspect AuthContext, LaunchPortalPage, App.tsx, supabase.ts first.',
  },
  {
    id: 'weather',
    title: 'Weather Skill',
    description: 'Operational weather guidance with clear source, fallback, and setup behavior.',
    docPath: 'docs/skills/weather-skill.md',
    relatedPages: ['/app/weather', '/app/dashboard'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/weather-skill.md. TASK: improve WeatherPage operational reliability. Keep existing data model and Supabase flow. No broad rewrite.',
  },
  {
    id: 'scheduler',
    title: 'Scheduler Skill',
    description: 'Weekly workforce planning rules for shifts, validation, and totals.',
    docPath: 'docs/skills/scheduler-skill.md',
    relatedPages: ['/app/scheduler'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/scheduler-skill.md. TASK: improve weekly schedule grid behavior and save integrity. Preserve existing handlers and table names.',
  },
  {
    id: 'workboard',
    title: 'Workboard Skill',
    description: 'Daily labor board patterns for assignment workflow and hour alignment.',
    docPath: 'docs/skills/workboard-skill.md',
    relatedPages: ['/app/workboard'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/workboard-skill.md. TASK: improve task assignment workflow for scheduled employees. Keep scheduler coupling and Supabase queries intact.',
  },
  {
    id: 'equipment',
    title: 'Equipment Skill',
    description: 'Fleet type/unit/status management patterns tied to assignment readiness.',
    docPath: 'docs/skills/equipment-skill.md',
    relatedPages: ['/app/equipment', '/app/workboard'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/equipment-skill.md. TASK: improve equipment types/units/status and workboard availability rules with minimal changes.',
  },
  {
    id: 'reports',
    title: 'Reports Skill',
    description: 'Labor, task, and cost report generation using real Supabase data.',
    docPath: 'docs/skills/reports-skill.md',
    relatedPages: ['/app/reports'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/reports-skill.md. TASK: improve report filters/outputs using saved data only. No fake totals and no operational data mutation.',
  },
  {
    id: 'branding',
    title: 'Branding Skill',
    description: 'Ground Crew HQ branding consistency across shell, login, and assets.',
    docPath: 'docs/skills/branding-skill.md',
    relatedPages: ['/', '/app/settings'],
    recommendedCodexPromptTemplate:
      'Use AGENTS.md and docs/skills/branding-skill.md. TASK: align visible app branding and icons to Ground Crew HQ / HQ without changing auth behavior.',
  },
];

