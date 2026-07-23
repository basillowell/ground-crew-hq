# Revenue Chain — Implementation Plan

> Status: **PLAN / AWAITING REVIEW** — nothing implemented, no migrations applied.
> Author: Claude Code · Date: 2026-07-23 · Grounded at commit `b6ed14d`,
> Supabase project `fjqeekwisnbpxgebrnpl`, app v7.19.6.
>
> Read [revenue-chain-handoff.md](revenue-chain-handoff.md) first — it has the
> verified current-state audit. The six D-A…D-F decisions from that doc are **locked**
> (summarized in §0) and this plan is built on them.
>
> **Schema authority is [live-db-state.md](live-db-state.md)** (Rule 10). Every column
> named in a phase's `DB_CHANGE_REQUIRED` spec must be re-confirmed against that file
> after each migration lands, before any query is written.

---

## 0. Locked decisions + what remains open

### Locked (from the handoff discussion)

| | Decision |
|---|---|
| **D-A Processor** | Manual payment recording only this pass. No Stripe/Square/processor code. |
| **D-B Estimates** | Separate `estimates` table; **converts to** an `invoice` on acceptance (both rows retained for history). |
| **D-C Line items** | Normalized `estimate_line_items` + `invoice_line_items` tables. No jsonb. |
| **D-D Job coupling** | Ad-hoc many-to-many via an `invoice_work_orders` join table (0..N jobs per invoice). |
| **D-E Recurring** | In v1. `service_contracts` table + an invoice-generation mechanism. |
| **D-F Tax** | Flat manual `tax_rate` (already on `invoices`). No tax engine. |

### Resolved 2026-07-23 (all five locked)

| | Decision | Effect on plan |
|---|---|---|
| **O-1** | **Build a minimal `service_catalog` now** (Phase 2). | Catalog table is no longer optional; it ships in Phase 2. |
| **O-2** | **Link everything** — add `assignments.work_order_id` so cost reconciles to the billed unit and per-job profit is real. | Adds a schema change (moved into Phase 3) and **un-blocks** true per-job Job Costing. See residual allocation wrinkle in R-2. |
| **O-3** | **Scheduled / automatic** recurring generation (not a manual button). | Phase 4 generation becomes a server-side DB function invoked on a schedule (pg_cron or Supabase Edge Function) — **infrastructure Basil applies/delegates, not pure app-layer.** Raises Phase 4 complexity; see R-1/R-9. |
| **O-4** | **Drop** `invoices.line_items jsonb` (0 rows, superseded). | Included in Phase 1 migration. |
| **O-5** | **Global serial** for `invoice_number` / `estimate_number` (matches `work_orders.wo_number`). | No per-org sequential numbering in v1. |

Two of these (O-2, O-3) increase scope beyond the original recommendations and are the
reason Phases 3 and 4 carry more schema/infra than the first draft. Called out at the
head of each affected phase.

---

## 1. Hard constraints this plan is built around

| Constraint | Source | Consequence |
|---|---|---|
| Agents never author SQL/migrations/RLS | Rule 1, Hard Boundary | Each phase's schema is a `DB_CHANGE_REQUIRED` **spec**. Basil applies it, or delegates back via Supabase MCP (as with the recent cleanup). UI work begins only after the tables exist and `live-db-state.md` is regenerated. |
| Two queries, never nested select | Rule 5 | Rendering one invoice = separate fetches for the invoice, its line items, its linked work orders, its client, its payments — stitched in TypeScript. This is the single biggest ergonomics cost of the normalized design; budget for it. |
| Bounded timeout on every queryFn | Rule 22 | Every new fetch wraps in `Promise.race` against a 15s timeout, mirroring `fetchProjects` (`supabase-queries.ts:1397`). |
| Never blank, never infinite | Rule 6 | Every new page/section: skeleton → error + working Retry → content. |
| No sentinel into uuid columns | Rule 14 | `currentPropertyId` may be `'all'`; guard before it reaches any FK on an estimate/invoice/contract insert. Mirror the `enabled: Boolean(propertyId && propertyId !== 'all' && orgId)` guard at `supabase-queries.ts:1544`. |
| Property inserts need duplicate-submit protection | Rule 13 | Applies in spirit to every money-creating insert here (create invoice, accept estimate, record payment, generate recurring batch): disable the action while in flight. Double-submitting "record payment" or "generate invoices" is a financial-data hazard, not just a cosmetic one. |
| Column names from `live-db-state.md` | Rule 10 | No query references a new column until the doc lists it post-migration. |
| Admin/manager RLS scopes to org | Rule 17 | All new tables get an `org_isolation` policy of the exact live form: `org_id = (select org_id from app_users where id = auth.uid())`. |
| Client-facing reads use token-RPC, never `USING (true)` | cc3fd91 (the `clients` fix) | **No client-facing hosted estimate/invoice view in v1** — acceptance and payment are staff-internal actions. If a hosted view is added later it MUST go through a `SECURITY DEFINER` RPC that takes a token and returns one row. Do not add a public read policy to any revenue table. |
| No processor/tech vocabulary in customer UI | Rule 8 | Copy says "estimate", "invoice", "payment", "plan". Never "Stripe", "RPC", "migration". |
| Build before commit | Rule 9 | `npm run build` passes before every commit; each phase is independently buildable. |
| One concern per pass | Rule 12 | Each phase below is a separate session/commit. |

---

## 2. Target entity model (end state after all phases)

```
clients ──1:N── invoices ──1:N── invoice_line_items
   │                │  │└─N:M─(invoice_work_orders)─N:M── work_orders
   │                │  └─1:N── payments
   │                └──(from)── estimates ──1:N── estimate_line_items
   │                               ▲
   └──1:N── service_contracts ─────┘ (generates invoices per period)
                    └── (template) ── service_contract_line_items
service_catalog ──(optional source for)── *_line_items   [O-1]
```

New tables: `estimates`, `estimate_line_items`, `invoice_line_items`,
`invoice_work_orders`, `payments`, `service_contracts`,
`service_contract_line_items`, and (pending O-1) `service_catalog`. Plus new columns on
`invoices` (`client_id`, `invoice_number`, `contract_id`, period fields) and on
`estimates`/`clients` as specced per phase.

Reused as-is: `clients`, `invoices` (extended), `work_orders`, `employees.hourly_rate`
(cost side), `org_isolation` RLS precedent, the `supabase-queries.ts` fetch/mutation
shape, the `work_order_jobs` child-table precedent (org_id + cascade FK).

---

## 3. Phase 1 — Clients + make an invoice billable

Goal: a client can exist and an invoice can attach to one. Smallest step that removes the
structural blocker. No estimates or payments yet.

### DB_CHANGE_REQUIRED (spec, Basil applies)

```
DB_CHANGE_REQUIRED: Phase 1 — client billing link

(1) invoices — ADD COLUMNS
    client_id       uuid  nullable  (FK -> clients.id)
        Nullable because 0 existing rows and future ad-hoc invoices may pre-date a
        client record; app-layer requires it on create. Not NOT NULL to avoid a
        forced backfill and to match how the codebase treats new FKs.
    invoice_number  (global serial, matching work_orders.wo_number precedent)   [O-5]
    DROP COLUMN line_items (jsonb) — superseded by invoice_line_items in Phase 2,
        0 rows today.   [O-4: confirm]
    INDEX on client_id (RLS/query-referenced).

(2) clients — no schema change. Already has org_isolation (verified, cc3fd91).
    Confirm the columns the UI needs exist: name, email, phone, address, notes,
    active (all present per live-db-state.md).

RLS: invoices already has org_isolation (ALL). No new policy. Adding client_id does
not require a policy change; confirm the existing ALL policy covers writes to it.
```

### UI / code

| File | Action |
|---|---|
| `src/pages/ClientsPage.tsx` | **New.** List + create/edit/deactivate clients. Skeleton/error/retry (Rule 6). Duplicate-submit guard on save (Rule 13). |
| `app/app/clients/page.tsx` | **New.** Re-export shell, mirroring `app/app/invoicing/page.tsx`. |
| `src/components/AppSidebarRefined.tsx` + `AppSidebar.tsx` | **Edit.** Add "Clients" nav entry (admin/manager module). Watch the lucide import-shadow rule — pick a non-builtin icon name or alias it (see `product-audit.md` / the `Map` incident). |
| `src/lib/supabase-queries.ts` | **Edit.** Add `useClients(orgId)`, `useCreateClient`, `useUpdateClient`, and extend the invoice fetch to select `client_id` + `invoice_number`. Mirror the `fetchProjects`/`createProject` shape exactly (`:1397`, `:1437`): `Promise.race` timeout, `.eq('org_id', orgId)`, `toX` mapper, `enabled` guards. |
| `src/pages/InvoicingPage.tsx` | **Edit.** Add a create-invoice flow (currently list-only, `:1-55`). On create, require a `client_id` (guard `currentPropertyId === 'all'` per Rule 14 before using it as `property_id`). Render client name — fetched separately and joined in TS (Rule 5), not via PostgREST embed. |

---

## 4. Phase 2 — Estimates, normalized line items, conversion

Goal: build a quote, itemize it, accept it, and have acceptance produce an invoice. This
is the spine and the conversion-rate metric.

### DB_CHANGE_REQUIRED (spec, Basil applies)

```
DB_CHANGE_REQUIRED: Phase 2 — estimates + normalized line items (+ optional catalog)

(1) NEW TABLE estimates
    id             uuid pk default gen_random_uuid()
    org_id         uuid NOT NULL
    client_id      uuid NOT NULL  (FK -> clients.id)
    property_id    uuid nullable  (FK -> properties.id; which property the work is on)
    estimate_number (global serial)   [O-5]
    status         text NOT NULL default 'draft'
                   CHECK ('draft','sent','accepted','declined','expired')
    subtotal       numeric NOT NULL default 0
    tax_rate       numeric NOT NULL default 0
    total          numeric NOT NULL default 0
    notes          text nullable
    valid_until    date nullable
    converted_invoice_id uuid nullable (FK -> invoices.id; set on acceptance)
    created_at     timestamptz NOT NULL default now()
    sent_at        timestamptz nullable
    accepted_at    timestamptz nullable

(2) NEW TABLE estimate_line_items
    id             uuid pk default gen_random_uuid()
    org_id         uuid NOT NULL           (carried for org_isolation without a join)
    estimate_id    uuid NOT NULL (FK -> estimates.id, ON DELETE CASCADE)
    catalog_id     uuid nullable (FK -> service_catalog.id if O-1 = yes)
    description    text NOT NULL
    quantity       numeric NOT NULL default 1
    unit_price     numeric NOT NULL default 0
    line_total     numeric NOT NULL default 0   (app-computed qty*unit_price; or GENERATED)
    sort_order     integer NOT NULL default 0
    created_at     timestamptz NOT NULL default now()

(3) NEW TABLE invoice_line_items
    (identical shape to estimate_line_items, FK invoice_id -> invoices.id CASCADE)

(4) NEW TABLE service_catalog  [O-1 = build now, minimal]
    id, org_id NOT NULL, name text NOT NULL, description text, default_unit_price
    numeric, active boolean default true, created_at. Reusable priced items that
    line items and contract templates draw from. Minimal shape — no categories,
    tax classes, or units in v1; those are a clean follow-on if wanted.

RLS: org_isolation on every new table, exact live form:
     USING (org_id = (select org_id from app_users where id = auth.uid()))
     Carry org_id on the child line-item tables so the policy needs no join
     (matches the project_timeline_events denormalization precedent).
INDEX: estimate_id / invoice_id on the line-item tables; org_id on all.
     Follow the work_order_jobs child-table precedent (cascade FK + org_id).
```

### UI / code

| File | Action |
|---|---|
| `src/pages/EstimatesPage.tsx` | **New.** List estimates by status (Draft/Sent/Accepted/Declined); create/edit with a line-item editor. Duplicate-submit guard. |
| `app/app/estimates/page.tsx` | **New.** Re-export shell. |
| `src/components/revenue/LineItemEditor.tsx` | **New.** Shared add/remove/reorder priced rows; live subtotal/tax/total. Reused by estimates, invoices, and contract templates. If O-1=yes, a picker seeds a row from `service_catalog`. |
| `src/lib/supabase-queries.ts` | **Edit.** `useEstimates`, `useEstimateLineItems(estimateId)`, `useInvoiceLineItems(invoiceId)`, create/update mutations, and (O-1) `useServiceCatalog`. Line items fetched separately and stitched (Rule 5). |
| `src/lib/revenue/convertEstimate.ts` | **New.** The accept→invoice conversion: in one client-side sequence (Rule 5, multiple inserts), create the `invoice` from the estimate, copy `estimate_line_items` → `invoice_line_items`, set `estimates.status='accepted'`, `accepted_at`, `converted_invoice_id`. Wrap so a partial failure is visible; note there is no cross-statement DB transaction over PostgREST — see Risk R-2. |
| `src/pages/InvoicingPage.tsx` | **Edit.** Render normalized line items (separate fetch); drop any jsonb `line_items` reference. |
| Settings — service catalog | **Edit** `SettingsPage.tsx` (or a new settings tab) for `service_catalog` CRUD. Note Rule 7 — `SettingsPage` is the known-fragile file; add this as a new isolated child component, do not deep-edit the 4,899-line file. |

---

## 5. Phase 3 — Manual payment recording + Job Costing revenue side

Goal: record that money came in (no processor), close the loop, and give Job Costing its
missing revenue side.

### DB_CHANGE_REQUIRED (spec, Basil applies)

```
DB_CHANGE_REQUIRED: Phase 3 — manual payments

(1) NEW TABLE payments
    id            uuid pk default gen_random_uuid()
    org_id        uuid NOT NULL
    invoice_id    uuid NOT NULL (FK -> invoices.id)
    amount        numeric NOT NULL
    method        text NOT NULL  CHECK ('cash','check','card','ach','other')
                  (manual record of method only — NO processor, NO card data stored)
    reference     text nullable  (check number, memo)
    paid_at       timestamptz NOT NULL default now()
    recorded_by   uuid nullable  (FK -> employees.id)
    notes         text nullable
    created_at    timestamptz NOT NULL default now()

A separate payments table (not columns on invoices) supports PARTIAL and MULTIPLE
payments per invoice — industry standard. invoices.status becomes derived: 'paid'
when sum(payments.amount) >= invoices.total; invoices.paid_at set when fully paid.

RLS: org_isolation, exact live form. INDEX invoice_id, org_id.
Explicitly store NO card numbers / PAN / processor tokens — method is a label only.

(2) assignments — ADD COLUMN  [O-2 = link everything]
    work_order_id  uuid nullable  (FK -> work_orders.id)
        Ties the labor unit (assignments) to the billed unit (work_orders) so
        per-job profit is computable. Nullable: existing assignments predate this
        and won't have it; new/edited assignments set it. No forced backfill —
        historical assignments with NULL simply don't roll up per-job until
        edited. INDEX work_order_id.
        RLS: assignments already has its policy; adding a column needs no change.
```

### UI / code

| File | Action |
|---|---|
| `src/components/revenue/RecordPaymentDialog.tsx` | **New.** Amount, method, reference, date. **Strong** duplicate-submit guard (Rule 13) — double-recording a payment is a real financial error. |
| `src/lib/supabase-queries.ts` | **Edit.** `usePayments(invoiceId)`, `useRecordPayment`; recompute invoice status from summed payments in TS (or a `DB_CHANGE_REQUIRED` derived view — decide, but keeping it app-side avoids more SQL). |
| `src/pages/InvoicingPage.tsx` | **Edit.** Payment history per invoice; balance-due; "Record payment" action. |
| `src/pages/JobCostingPage.tsx` | **Edit.** Add the revenue side. With O-2's `assignments.work_order_id` link, per-job profit is now real: cost = Σ(`actual_hours × hourly_rate`) of assignments on a work order; revenue = amount attributed to that work order via `invoice_work_orders`. Also needs an `assignments.work_order_id` picker wherever assignments are created/edited (Scheduler/Workboard) so the link actually gets populated going forward — otherwise the column stays NULL and per-job costing shows nothing. Keep a property+period rollup too, for historical/unlinked assignments. |
| Scheduler / Workboard assignment editors | **Edit.** Add an optional "work order" selector to assignment create/edit, writing `work_order_id`. This is what makes O-2 real data rather than an empty column. Scope carefully (Rule 12) — touching `WorkboardContent.tsx` (7,019 lines) is its own hazard; a minimal, isolated selector only. |

---

## 6. Phase 4 — Recurring service contracts

Goal: define a recurring plan for a property/client and generate its invoices per period.
The retention feature; the biggest scope addition versus the handoff's original phasing.

### DB_CHANGE_REQUIRED (spec, Basil applies)

```
DB_CHANGE_REQUIRED: Phase 4 — recurring service contracts

(1) NEW TABLE service_contracts
    id            uuid pk default gen_random_uuid()
    org_id        uuid NOT NULL
    client_id     uuid NOT NULL (FK -> clients.id)
    property_id   uuid nullable (FK -> properties.id)
    name          text NOT NULL
    status        text NOT NULL default 'active'
                  CHECK ('active','paused','ended')
    frequency     text NOT NULL  CHECK ('weekly','biweekly','monthly','quarterly','seasonal')
    start_date    date NOT NULL
    end_date      date nullable
    pause_from    date nullable
    pause_until   date nullable
    tax_rate      numeric NOT NULL default 0
    notes         text nullable
    created_at    timestamptz NOT NULL default now()

(2) NEW TABLE service_contract_line_items
    (template rows: same shape as invoice_line_items, FK contract_id CASCADE,
     optional catalog_id if O-1)

(3) invoices — ADD COLUMNS (idempotency for generation)
    contract_id   uuid nullable (FK -> service_contracts.id)
    period_start  date nullable
    period_end    date nullable
    UNIQUE (contract_id, period_start) WHERE contract_id IS NOT NULL
        — prevents generating the same period's invoice twice. This constraint is
        the safety net behind the app-layer generation guard (O-3).

(4) GENERATION MECHANISM  [O-3 = scheduled/automatic]
    A SECURITY DEFINER plpgsql function (e.g. generate_due_contract_invoices())
    that, for every active contract whose next period is due (respecting
    frequency, start/end, pause window), inserts one invoice + copied line items
    stamped contract_id/period_start/period_end. Being a single DB function it is
    transactional per contract — which also resolves R-1 for this path (no
    app-layer multi-insert).
    Invoked on a schedule via pg_cron (daily) OR a Supabase Edge Function with a
    cron trigger. Idempotent: the UNIQUE (contract_id, period_start) constraint
    means a re-run is a no-op, so overlapping/retried schedule fires can't
    double-bill.

(5) NEW TABLE contract_invoice_runs (generation audit log)
    id, org_id, run_at timestamptz, period_start date, period_end date,
    contracts_processed int, invoices_created int, error text nullable.
    Because no human watches each automatic run, an audit trail is required to
    see what fired, what it produced, and what failed.

RLS: org_isolation on new tables + child. INDEX org_id, client_id, contract_id.

INFRASTRUCTURE NOTE (Rule 1 / Hard Boundary): the function, the pg_cron schedule
(or Edge Function + cron trigger), and any service-role wiring are database/infra,
NOT app code. Basil applies them (or delegates via the Supabase MCP
apply_migration / deploy_edge_function tools). The app's only job is to read
contracts, their line items, and the run log — plus an optional manual
"generate now" trigger for testing that calls the same function.
```

### UI / code

| File | Action |
|---|---|
| `src/pages/ContractsPage.tsx` | **New.** List/create/edit contracts with a template `LineItemEditor` (reused from Phase 2), frequency, dates, pause window. |
| `app/app/contracts/page.tsx` | **New.** Re-export shell. |
| Generation function + schedule | **DB_CHANGE_REQUIRED (Basil/infra), not app code.** Per O-3 the generation logic lives in a SECURITY DEFINER DB function on a pg_cron/Edge-Function schedule (spec above), not in a `src/` file. There is no `generateContractInvoices.ts`. |
| `src/lib/supabase-queries.ts` | **Edit.** `useContracts`, `useContractLineItems`, contract create/update, `useContractInvoiceRuns` (read the audit log), and an optional `.rpc('generate_due_contract_invoices')` mutation behind a "generate now" testing button (admin-only, strong duplicate-submit guard, Rule 13). |
| `src/components/revenue/ContractRunLog.tsx` | **New.** Surface the `contract_invoice_runs` audit log so an admin can see what the scheduler produced and whether anything errored. |

---

## 7. Risks, ranked

1. **R-1 — No cross-table DB transaction over PostgREST.** The estimate→invoice conversion
   (Phase 2) performs several inserts that must all succeed together, and supabase-js has no
   client-side multi-statement transaction, so a mid-sequence failure leaves a half-built
   invoice. **Mitigation: do the conversion in a `SECURITY DEFINER` DB function** (one
   transactional call, `DB_CHANGE_REQUIRED`, Basil authors) rather than app-layer inserts.
   *Note O-3 already removes this risk from Phase 4* — scheduled generation is a DB
   function, hence transactional per contract by construction. Phase 2 conversion is now the
   main place this bites; recommend the same function-based approach there.
2. **R-2 — Per-job revenue attribution wrinkle (residual after O-2).** O-2 adds the
   `assignments.work_order_id` link, so cost-per-job is now computable. But invoices are
   many-to-many with work orders (`invoice_work_orders`), so when one invoice covers several
   work orders, **revenue must be *attributed* across them** to get per-job margin. Options:
   attribute by line item (if line items carry a `work_order_id`), or split evenly, or by
   labor share. Decide during Phase 3 build. The link (O-2) is the prerequisite; attribution
   is the remaining detail. Also: per-job costing only reflects assignments whose
   `work_order_id` was actually populated (nullable, no backfill), so early data will be
   partial — set that expectation in the UI.
3. **R-3 — Money integrity from double-submit.** "Record payment" and "Generate invoices"
   are financial mutations; a double-click creates real bad data. Rule 13's in-flight
   disable is mandatory on every money-creating action, plus the Phase 4 UNIQUE constraint.
4. **R-4 — Rule 5 read amplification.** One invoice view = 4–5 separate queries (invoice,
   line items, work-order links, client, payments) stitched in TS. Manageable, but budget
   the effort and lean on react-query caching; don't reach for a PostgREST embed to shortcut
   it.
5. **R-5 — Client-facing surface reintroducing the `clients` bug.** v1 is staff-internal,
   so this stays dormant — but the moment a hosted estimate/invoice link is wanted, it must
   use the token-RPC pattern (cc3fd91), never `USING (true)`. Called out here so a later
   phase doesn't forget.
6. **R-6 — Numbering races (O-5).** Global serial sidesteps races but leaks counts and
   isn't per-org. Per-org sequential numbering would need careful concurrency handling.
7. **R-7 — `SettingsPage.tsx` fragility (Rule 7).** If O-1's catalog CRUD lands in
   Settings, add it as an isolated child component; do not deep-edit the 4,899-line file.
8. **R-8 — lucide icon-shadow regression.** New nav entries (Clients, Estimates,
   Contracts) import icons; avoid names shadowing JS builtins or alias them. Same class as
   the `Map`/`Menu` incident (`product-audit.md`).
9. **R-9 — Scheduled generation is unattended infra (O-3).** Automatic invoice creation
   means bad output ships with no human in the loop. Hard dependencies: the
   UNIQUE (contract_id, period_start) constraint must exist *before* the schedule is
   enabled (idempotency), the `contract_invoice_runs` log must be watched, and the
   pause-window / end-date logic must be correct or it will bill paused or ended contracts.
   Recommend enabling the schedule only after the manual "generate now" path has been run
   against real contracts and verified. This is the operational risk O-3 introduces that a
   button would not have.

---

## 8. Sequencing

```
Phase 1  Clients + invoice.client_id + drop jsonb line_items   (unblocks everything)
   ↓     regenerate live-db-state.md   (Rule 10 gate — after every phase's migration)
Phase 2  Estimates + normalized line items + conversion + service_catalog
Phase 3  Manual payments + assignments.work_order_id link + per-job Job Costing
Phase 4  Recurring contracts + scheduled generation + run log
```

All five open decisions are resolved (§0), so no phase is gated on a pending call. Each
phase is one feature area (Rule 12), independently buildable, `npm run build`-clean before
commit (Rule 9), commit+push in the same session once verified (Rule 20).

**Recommended immediate next step:** start Phase 1. It's the smallest slice, unblocks
everything, and its migration (add `client_id` + `invoice_number`, drop `line_items`) is a
short `DB_CHANGE_REQUIRED` ready to apply.

---

## 9. What this plan deliberately does not do

- No Stripe/Square/QuickBooks/any processor (D-A).
- No client-facing hosted estimate/invoice/payment page (deferred; must be token-RPC when
  built).
- No tax engine (D-F).
- No card/PAN/processor-token storage anywhere (payments records a method label only).
- Recurring generation *is* scheduled/automatic (O-3), but the schedule should only be
  enabled after the manual "generate now" path is verified against real contracts (R-9).

---

## 10. Reference

- Template shape: [property-map-implementation.md](property-map-implementation.md)
- Decisions + current-state audit: [revenue-chain-handoff.md](revenue-chain-handoff.md),
  [product-audit.md](product-audit.md)
- RLS precedent to copy: `clients` / `invoices` `org_isolation` (verified live);
  child-table precedent: `work_order_jobs`, `project_timeline_events`
- Query/mutation shape to mirror: `src/lib/supabase-queries.ts:1397-1560`
- The `USING (true)` anti-pattern this must never reintroduce: commit `cc3fd91`
