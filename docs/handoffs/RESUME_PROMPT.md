# Ground Crew HQ — UI Modernization Resume Prompt

Paste this into Claude Code to resume the session.

---

We were modernizing Ground Crew HQ's UI with 2026 SaaS design trends.
Check what was last changed with:

git diff --name-only HEAD
npx tsc --noEmit 2>&1 | head -20

Then pick up where we left off. Remaining steps:

- [ ] tailwind.config.js — color tokens, shadows, keyframes
- [ ] src/index.css — @keyframes, floating label, glassmorphism utilities
- [ ] Button component
- [ ] Input component
- [ ] Landing page
- [ ] SignIn panel (LaunchPortalPage.tsx)
- [ ] SignUp panel (LaunchPortalPage.tsx)
- [ ] ForgotPassword panel (LaunchPortalPage.tsx)
- [ ] ResetPasswordPage.tsx + App.tsx route
- [ ] AppLayout + Sidebar + TopBar
- [ ] Supervisor bento grid dashboard
- [ ] Employee field view + FAB

Project context:
- Repo: C:\Projects\ground-crew-hq
- Stack: React + Vite + Tailwind + Supabase + Vercel
- Colors: #0f1a14 base, #a3e635 lime accent, dark-first
- Tailwind only, no new libraries
- Never touch AuthContext.tsx or existing route guards
- Grep before editing, confirm after each file