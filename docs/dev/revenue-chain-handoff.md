# Revenue Chain — Discussion Handoff

> Purpose: a briefing to take into Claude chat for a strategy/design discussion,
> **before** any schema is designed or code is written. This is the highest-leverage
> gap from the 2026-07-23 product audit ([product-audit.md](product-audit.md)).
> Not an implementation plan — the point is to make the decisions that a plan would
> otherwise guess at.
>
> Grounded in the live schema at commit `503c335`, Supabase project
> `fjqeekwisnbpxgebrnpl`, app v7.19.6.

---

## The one-paragraph problem

Ground Crew HQ can run a crew's day but cannot make money on paper. The industry-
standard chain is **Lead → Estimate → Approved Job → Scheduled Work → Invoice →
Payment**, with data and dollars carried across every stage. Today the middle
(scheduling/execution) is strong, both ends (estimate, payment) are missing, and the
one billing table that exists can't attach an invoice to a customer. Closing this is
what turns the app from "a tool my crew uses" into "the system that runs my business"
— the thing that justifies pricing and prevents churn.

---

## What exists today (verified)

| Piece | State |
|---|---|
| `clients` | Table exists, **0 rows**, now correctly org-scoped (world-read policy dropped 2026-07-23). No UI creates or lists clients. |
| `invoices` | Table exists, **0 rows**. Columns: `id, org_id, property_id, employee_id, status(draft/sent/paid/void), line_items(jsonb), subtotal, tax_rate, total, notes, created_at, sent_at, paid_at`. **No `client_id`.** |
| `InvoicingPage` | Lists/filters invoices by Draft/Sent/Paid. Real page, but nothing to bill against. |
| `JobCostingPage` | Computes labor cost from `assignments.actual_hours` × wage. **No revenue side** — it is structurally half a feature until invoices carry real money linked to jobs. |
| Estimates / quotes | **Do not exist.** No table, no code. |
| Payments | **Do not exist.** Zero payment-processor code anywhere in `src/`. |
| `work_orders`, `assignments`, `tasks` | Strong. This is the "approved job → scheduled work" middle that already works. |

---

## The decisions to make in chat (this is the actual point)

These are product/strategy calls, not engineering details. Each one changes the schema
and the build materially, so they should be settled by a human before a plan is drawn.

### D-A. Payment processor — the biggest fork

Everything downstream (schema, PCI scope, payout timing, fee handling, refunds) depends
on this. The realistic options for a US field-service SMB app:

- **Stripe** — the default. Best docs, Connect for multi-tenant payouts, ACH + card,
  strong invoicing primitives. Higher-effort integration, and the org-per-payout model
  (Stripe Connect) is a real design decision in a multi-org app.
- **Square** — strong if customers already use Square for in-person/point-of-sale.
  Simpler onboarding, weaker for pure-SaaS recurring.
- **QuickBooks-only, no in-app payment** — many small landscape businesses already run
  billing through QuickBooks. Option: don't process payments at all, and instead sync
  invoices out to QuickBooks. Much smaller build, but cedes the payment moment (and its
  data) to a third party.
- **Manual/offline** — record that a check/cash payment happened, no processing. Cheap,
  and honestly where many of these businesses actually are. A viable v1 that de-risks
  the processor decision.

**Recommendation to weigh:** ship **manual payment recording first** (status + method +
reference + paid_at), then layer Stripe on top once the estimate→invoice spine is
proven. It decouples the hard integration from the schema work and lets the revenue
*reporting* light up immediately.

### D-B. Estimate as its own table, or invoice with a status?

- **Separate `estimates` table** that converts into an `invoice` on acceptance — cleaner
  history, supports quote→win conversion metrics, matches how Jobber/Aspire model it.
- **One `invoices` table** with a lifecycle `estimate → sent → accepted → paid` — less
  duplication, but muddies reporting and makes "quote acceptance rate" awkward.

**Recommendation to weigh:** separate table. The conversion-rate metric is a big part of
why an owner wants this, and it is painful to reconstruct later from a status column.

### D-C. Line items — normalize or keep jsonb?

`invoices.line_items` is currently `jsonb`. Normalizing into an `invoice_line_items`
table (and `estimate_line_items`) is what enables "what services actually sell / at what
margin" reporting. Keeping jsonb is faster now but forfeits that analysis permanently.

**Recommendation to weigh:** normalize. It is the difference between billing software and
a billing screen. This also feeds a potential `service_catalog` (reusable priced line
items) that estimates draw from.

### D-D. What does an invoice attach to?

Add `client_id` (required — you bill a client) and keep `property_id` (which property the
work was on) and optionally `work_order_id` / `assignment_id` (which job it bills for).
The job link is what finally lets Job Costing compare revenue to labor cost per job.

**Decision:** how tightly to couple invoice → job. One invoice per work order? Per
property per month (recurring maintenance)? Ad-hoc? This drives the FK shape.

### D-E. Recurring / contract billing — v1 or later?

Lawn maintenance is overwhelmingly seasonal contract work: same property, same crew,
billed monthly/seasonally. Competitors auto-generate these invoices. This is arguably the
highest-value feature for the actual customer — and the most complex (billing schedules,
proration, seasonal pauses). Decide whether it is in the first cut or an explicit phase 2.

### D-F. Tax

`invoices.tax_rate` is a flat number today. US sales tax on landscaping services is
jurisdiction-specific and, in some states, service-vs-materials-dependent. Decide: flat
manual rate (fine for v1), or real tax handling (Stripe Tax / Avalara) later.

---

## Constraints any eventual plan must respect (codebase-specific)

Carry these into the discussion so options aren't proposed that the repo forbids:

- **Rule 1 / Hard Boundary:** agents don't author executable SQL/RLS. New tables
  (`estimates`, line-item tables, `client_id` FK) are a `DB_CHANGE_REQUIRED` spec that
  Basil applies (or delegates to Claude Code via MCP, as was done for the cleanup).
- **Rule 5:** no PostgREST nested selects — invoice↔client↔property↔job joins happen in
  TypeScript. This makes normalized line items slightly more work to read (two queries),
  which is worth knowing when weighing D-C.
- **RLS pattern:** every new table needs an `org_isolation` policy matching the existing
  precedent; anything client-facing (a payment page, a hosted invoice) needs the
  SECURITY-DEFINER-RPC-by-token approach, **never** a `USING (true)` read policy — that is
  the exact bug just fixed on `clients`.
- **Rule 14:** `currentPropertyId` can be the sentinel `'all'` — guard before it reaches
  any uuid FK on an estimate/invoice insert.
- **Rule 8:** no processor/tech vocabulary in customer-facing UI copy.
- **Money handling boundary (assistant-side):** an AI agent must not execute financial
  transactions or enter payment credentials. Building the *integration* is fine;
  *processing a live payment* is a human action. Worth stating so the eventual build
  plan puts the human in the right place.

---

## A possible phasing (straw man to react to, not a commitment)

1. **`clients` CRUD + `client_id` on invoices.** Smallest step that makes an invoice
   real. Unlocks nothing fancy but removes the structural blocker.
2. **`estimates` + line-item normalization + `service_catalog`.** The spine. Lights up
   conversion-rate and revenue-per-service reporting.
3. **Manual payment recording.** Revenue actually closes the loop; Job Costing becomes
   whole (revenue vs labor per job).
4. **Stripe (or chosen processor) integration.** Real money movement.
5. **Recurring/contract billing.** The retention feature.

Steps 1–3 need no payment processor and deliver most of the *reporting* value — which is
the argument for settling D-A last, not first.

---

## What to ask Claude chat to produce

After the six decisions above are made, the useful output is: a phased
`DB_CHANGE_REQUIRED` schema spec (tables, columns, FKs, RLS policies matching the
`org_isolation` precedent) plus a file-by-file UI build plan — the same shape as
[property-map-implementation.md](property-map-implementation.md), which is a good
template for how this codebase likes plans written.
