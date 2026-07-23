# Ground Crew HQ — Product Audit

> Date: 2026-07-23 · Audited at `6cd8260` · App v7.19.6
> Scope: how a user actually utilizes the app, and where it sits against
> industry standard for lawn/landscape field-service software.
>
> Comparison set: Aspire, LMN, Jobber, SingleOps, ServiceTitan, Yardbook.
>
> **Method:** every claim below was verified against the codebase or the live
> Supabase project (`fjqeekwisnbpxgebrnpl`), not inferred. Where something was
> checked and found *absent*, the check is named so it can be re-run.

---

## 1. Headline

The app is a **genuinely strong operations tool with no revenue chain attached.**

It can schedule crews, document regulated chemical applications, track equipment
maintenance, map property boundaries, and run SOP checklists — several of those at a
depth that beats mid-market competitors. What it cannot do is **quote a job, bill a
client, or take a payment.** For software sold to a lawn/grounds business owner, that
is the difference between "a tool my crew uses" and "the system that runs my company"
— and it is the gap that decides pricing power and churn.

Nothing below is a rewrite. The foundation is sound; the gaps are additive.

---

## 2. What is genuinely strong

These are real differentiators, not table stakes. Worth protecting.

| Capability | Why it matters |
|---|---|
| **Chemical + fertilizer application logging** (`chemical_application_logs`, tank-mix items, `fertilizer_application_logs`, rate/speed/area/product) | This is regulatory record-keeping most competitors treat as an afterthought. For a licensed applicator it is a legal requirement and a real switching cost. |
| **Property boundary mapping with computed acreage** (PostGIS, `calculated_acreage` cross-checked against manual `acreage`) | Measurement/takeoff is normally a paid add-on or separate tool. Having it native, on public-domain USGS aerial imagery with no per-tile cost, is a strong position. |
| **Equipment lifecycle** (`equipment_units`, QR scan-to-login at `/app/equipment/scan/[qrToken]`, maintenance intervals, hours-at-last-service) | QR-on-the-machine is a genuinely good field affordance. |
| **Weather integration** (NWS, `weather_daily_logs`, per-location stations) | Directly actionable for spray windows and rain-outs. Legally clean provider choice. |
| **SOP checklists with completion tracking** (`sops`, `sop_checklist_items`, `sop_completions`) | Training and accountability; underrated retention driver. |
| **Role-aware UI** | Employees get a field-focused shell (bottom nav, clock tab, no supervisor sidebar); admin/manager get the full surface. |

48 tables and ~26.5k lines across pages — this is a substantial, real product, not a
prototype.

---

## 3. The revenue chain is broken

This is the single highest-leverage finding. Industry standard is an unbroken
**Lead → Estimate → Approved Job → Scheduled Work → Invoice → Payment** chain, where
each stage carries data forward and the business owner can see conversion and margin
end to end.

Verified state of that chain:

| Stage | Status | Evidence |
|---|---|---|
| Lead / CRM | ✗ | `clients` table exists but is **empty (0 rows)** and unused by any routed page |
| Estimate / quote / proposal | ✗ **absent entirely** | No `estimates`/`quotes`/`proposals` table. Grep hits for "estimate" are all `estimated_hours` false positives |
| Approved job | ~ | `work_orders`, `assignments`, `tasks` exist — this part is strong |
| Scheduled work | ✓ | Scheduler + Workboard + Dispatch, substantial |
| Invoice | ~ **structurally incomplete** | `invoices` table exists, **0 rows** |
| Payment | ✗ **absent entirely** | **Zero Stripe/payment code in `src/`.** (An earlier probe suggesting otherwise was a false positive — `ach` matching inside "each"/"cache".) |

### `invoices` cannot bill a customer

```
invoices: id, org_id, property_id, employee_id, status, line_items(jsonb),
          subtotal, tax_rate, total, notes, created_at, sent_at, paid_at
```

**There is no `client_id`.** An invoice can be attached to a property and an employee
but not to the person who pays it. Also missing versus any billing system: invoice
number, due date / terms, payment method, transaction reference, partial payments,
credits. `line_items` as unnormalized `jsonb` blocks reporting on what actually sells.

### What this costs

- No quote→win conversion rate, so no sales pipeline visibility.
- No revenue per property, per crew, or per service line.
- **Job Costing is half a feature.** `/app/job-costing` can see labor cost but has no
  revenue to compare it against, so it cannot answer "did we make money on this job" —
  the single question owners most want answered.
- **No recurring/contract billing.** Lawn maintenance is overwhelmingly seasonal
  contract work. Competitors bill recurring plans automatically; this cannot.

**Recommendation — this is the #1 priority.** Add `estimates` and a `clients` FK on
`invoices`, then payment capture. Nothing else on this list changes the product's
category the way this does.

---

## 4. Field crew experience — the daily-use surface

`MobileFieldWorkspacePage.tsx` is 1,877 lines and clearly the most-used screen. Three
gaps are standard in every competitor:

### No offline support ✗
Verified: near-zero `serviceWorker` / `indexedDB` / offline-queue code. Crews work in
areas with no signal — under tree cover, on large rural properties, in equipment
sheds. Today a dead zone means **clock-ins and task completions silently fail**.
Rule 22's bounded timeouts prevent a hang, but the write is still lost.

This is the highest-severity *field* gap because it produces wrong payroll data, not
just inconvenience.

### No photo documentation ✗
Verified: **zero Supabase storage buckets exist** (`select * from storage.buckets`
returns empty). No upload path anywhere in the app.

Before/after photos are the core evidence artifact in field service — they resolve
customer disputes, prove completion, and are a standard marketing asset. Their absence
is conspicuous. This also blocks damage reporting, equipment fault documentation, and
chemical incident records.

### No signature capture ✗
Verified: zero matches for signature/sign-off. Blocks on-site customer sign-off, which
is how a completion becomes billable evidence.

### Also absent
- **Route optimization** — no drive-time sequencing between properties. Standard in
  Jobber/Aspire; direct fuel and labor savings.
- **Messaging is a stub** — `/app/messaging` renders a "Coming soon" badge, with a
  `TODO` noting no typed chat table exists. The `messages` table exists but is unused.

---

## 5. Customer-facing surface is effectively absent

### The client portal is orphaned dead code
`ClientPortalPage.tsx` is 266 lines, fully written — and **not routed**. There is no
`page.tsx` for it anywhere in `app/`, and nothing references it. It is unreachable.

It was also built against a `clients` table that has never held a row.

### No customer communications ✗
No SMS or email integration. Industry standard includes "crew is on the way" alerts,
appointment reminders, completion notices with photos, and invoice delivery. These
measurably reduce inbound "where are you?" calls — a real cost for the office manager
persona this app otherwise serves well.

---

## 6. Security and correctness (verified against the live database)

### Finding 1 — `clients` is world-readable · **fix before the first client row**

Confirmed via `pg_policies`:

```
clients | public_token_read | SELECT | roles={public} | qual=true
```

`USING (true)` means the policy applies **no filter**. Any holder of the anon key —
which ships in every browser bundle by design — can read **every row of `clients`
across every org**: name, email, phone, address, notes. The `.eq('client_token', …)`
in `ClientPortalPage` is a client-side query filter, not a security boundary.

**Severity today: low — the table has 0 rows and 1 org exists.** It becomes a real PII
breach the moment the client feature is used. The correct policy compares
`client_token` to a request parameter rather than returning `true`.

This is exactly the kind of "temporary, we'll tighten it later" policy that ships to
production. Fix it while it is still free to fix.

### Finding 2 — mutable `search_path` on two helpers · **downgraded to cosmetic**

*Corrected 2026-07-23 after inspecting `pg_proc`. The original version of this finding
called these "SECURITY DEFINER with a privilege-escalation vector." That was wrong on
both counts.*

`can_read_property` and `current_property_id` are **not** `SECURITY DEFINER`
(`prosecdef = false`) — they are plain `STABLE` functions that run as the caller, so a
mutable `search_path` grants nothing the caller did not already have. Their bodies
also reference every object fully schema-qualified (`public.employees`,
`public.current_org_id()`, `public.can_manage_property`), so `search_path` cannot
redirect them regardless.

The five helpers that *are* `SECURITY DEFINER` — `auth_app_user_id`,
`can_manage_property`, `current_employee_id`, `current_org_id`, `current_user_role` —
**all already have `SET search_path TO 'public'` pinned.** That part of the
authorization model is correctly hardened.

Net: pin `search_path` on the two remaining functions if you want a clean advisor
report, but this is lint hygiene, not a security fix. Do not prioritize it.

### Finding 3 — Authorization is enforced only at the data layer
Only `EmployeesPage` and `PropertiesMapPage` reference role at all. There is no route
guard stopping an `employee` from navigating directly to `/app/reports`,
`/app/job-costing`, or `/app/settings` — the sidebar simply doesn't show them.

Relying on RLS is a defensible architecture, **but it means RLS is load-bearing for
authorization on every page**, and that has not been verified per-page. Worth an
explicit test: sign in as an employee, hit each supervisor route directly, confirm
what renders. Adding page-level guards is constrained by CLAUDE.md ("no new route
guards without discussion") — so this is a discussion item, not a unilateral change.

### Finding 4 — Leaked-password protection is disabled
Supabase Auth can check credentials against HaveIBeenPwned. Currently off. One toggle.

### Finding 5 — Dead schema (no functional impact)
`department_options`, `group_options`, `manual_rainfall_entries` have RLS enabled with
**no policies** — i.e. deny-all. Verified they are queried by **zero** application
code, so nothing is broken. They are dead tables; drop them or add policies so the
advisor stops flagging them.

### Finding 6 — PostGIS hygiene (from our own migration)
`postgis` was installed into the `public` schema, and `spatial_ref_sys` (a PostGIS
system table) has RLS disabled — the one ERROR-level advisor finding. Low real risk
(reference data), but both are avoidable: extensions belong in a dedicated schema.

*Note: the 118 `pg_graphql_*_table_exposed` warnings are normal Supabase behaviour —
tables appear in the GraphQL schema but RLS still governs access. Not findings.*

---

## 7. Maintainability

| File | Lines | Risk |
|---|---|---|
| `WorkboardContent.tsx` | 7,019 | Single file holding the most complex surface in the app |
| `SettingsPage.tsx` | 4,899 | CODERULES Rule 7 already names this as the known-fragile file: "always rewrite if broken" |

A 7k-line component is where regressions hide and where two engineers cannot work in
parallel. That Rule 7 exists *specifically* for `SettingsPage` is the codebase telling
on itself. Neither is urgent, but both are compounding interest.

Also worth noting: `react-router-dom` is still a dependency after the Next migration,
and CLAUDE.md's own migration lessons say to remove it.

---

## 8. Prioritized recommendation

**Do first — cheap, and the window closes**
1. Fix the `clients` RLS policy (free now, a breach later). Concretely:
   `DROP POLICY public_token_read ON public.clients` — the table already carries a
   correct `org_isolation` policy, and because RLS policies are OR'd, the
   `USING (true)` policy is the only thing defeating it. Dropping it restores correct
   scoping with no replacement needed.
2. Enable leaked-password protection (one dashboard toggle).
3. Decide the fate of `ClientPortalPage` — route it or delete it. Orphaned auth-
   adjacent code is a liability. If routed, it needs a `SECURITY DEFINER` RPC that
   takes the token and returns one client — not a blanket read policy.
4. Optionally pin `search_path` on the two non-definer helpers to clear the advisor
   report (cosmetic — see Finding 2).

**Then — the category-defining work**

5. **Estimates → invoices → payments.** Add an `estimates` table; add `client_id` to
   `invoices`; normalize line items; integrate payment capture. This unlocks job
   costing, revenue reporting, and recurring contract billing simultaneously.

**Then — the field gaps that cause data loss**

6. **Offline write queue** for clock events and task completions. Highest-severity
   field issue because it corrupts payroll data rather than merely annoying.
7. **Photo capture** (needs a storage bucket — none exists). Unlocks proof-of-work,
   dispute resolution, damage reports.

**Then — the differentiated follow-ons**

8. Customer notifications (SMS/email).
9. Signature capture.
10. Route optimization.
11. Decompose `WorkboardContent` and `SettingsPage`.

---

## 9. Honest framing

The instinct to compare against industry standard is right, but note *which* standard:
the app is **ahead** of most competitors on regulatory/agronomic depth (chemical
records, weather, boundary measurement) and **behind** on commercial plumbing (quotes,
billing, payments, customer comms).

That is a good position to be in — the hard, domain-specific, defensible half is
built, and the missing half is well-trodden. But the missing half is what a business
owner evaluates during a trial. A prospect comparing against Jobber will notice "I
can't send an estimate" within ten minutes, and will never reach the chemical logging
that would have won them over.

**Sequencing recommendation: close the revenue chain before adding more operational
depth.** The operational tool is already better than it needs to be to win; the
commercial gap is what loses the deal.
