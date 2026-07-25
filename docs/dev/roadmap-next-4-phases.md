# Ground Crew HQ — Current State vs. Next 4-Phase Enhancement Package

> Prepared: 2026-07-24 · App v7.19.6 · HEAD `f14f490`
> For review. Nothing here is committed as work — it is an assessment plus a
> proposed forward plan. Grounded against the live codebase, the live Supabase
> project (`fjqeekwisnbpxgebrnpl`), and the product audit
> ([product-audit.md](product-audit.md)).

---

## Part 1 — Where the app stands right now

### What shipped this work session

27 commits since the session started. Two large feature tracks plus a run of
map bug fixes:

**Property Map (fully built)**
- Read-only map shell → boundary drawing (Geoman) → project timeline panel →
  **project pins** → **timeline progress photos**
- PostGIS boundaries with auto-calculated acreage cross-checking the manual field
- Private `project-photos` storage bucket (the app's first) with org-scoped RLS

**Revenue Chain (Phases 1–2 of 4 built)**
- Phase 1: `clients` + invoices linked to a client, invoice numbering
- Phase 2: `estimates`, normalized `estimate_line_items` / `invoice_line_items`,
  `service_catalog`, and a transactional `convert_estimate_to_invoice()` DB function

**Security / hygiene (done)**
- Dropped a world-readable `clients` RLS policy (would have leaked customer PII the
  moment the table was used)
- Removed orphaned dead code, dropped superseded legacy tables, pinned helper
  `search_path`, added missing FK indexes

### The revenue chain today

```
Lead ──► Estimate ──► Approved Job ──► Scheduled Work ──► Invoice ──► Payment
 [gap]     [BUILT]        [strong]         [strong]        [BUILT]     [GAP]
```

The two ends the audit flagged as missing — estimate and invoice — now exist and
are itemized and linked to a customer. **Payment capture and per-job costing are
the remaining gap.**

### The honest asterisk: none of it has been exercised

| Table | Rows |
|---|---|
| clients | 0 |
| estimates | 0 |
| invoices | 0 |
| service_catalog | 0 |
| projects | 1 (0 pinned) |
| project_timeline_events | 0 |
| project_photos | 0 |
| properties | 6 (5 with boundaries) |

Everything in the revenue chain and the new pins/photos surface is verified at
**build and schema level only**. No signed-in user has created a client, built an
estimate, accepted it, recorded a payment, dropped a project pin, or uploaded a
photo against real RLS. The single highest-value validation step before building
further is a ten-minute end-to-end run through each flow.

### Two things carried but unverified in a browser

1. **Boundary-edit fix** (`7f7d5ec`) — deployed, but the drag-to-edit-a-vertex path
   was never confirmed live (the browser pane went blank mid-test).
2. **Leaked-password protection** — still disabled in Supabase Auth. One dashboard
   toggle, owner action, no code.

---

## Part 2 — The gap map (audit scorecard, updated for this session)

| Capability | Before session | Now |
|---|---|---|
| Property boundary mapping | missing | **shipped** |
| Project visual tracking (pins) | missing | **shipped** |
| Progress photos | missing (0 buckets) | **shipped** (private bucket) |
| Client records | empty table | **shipped** |
| Estimates / quotes | missing | **shipped** |
| Invoices (billable to a client) | structurally broken | **shipped** |
| Normalized line items / catalog | jsonb blob | **shipped** |
| Payment capture | missing | **still missing** |
| Per-job profitability | impossible (no link) | **still missing** |
| Recurring / contract billing | missing | **still missing** |
| Offline field reliability | missing | **still missing** |
| Customer notifications (SMS/email) | missing | **still missing** |
| Field/mobile photo + signature capture | missing | **partial** (desktop photos only) |
| Hosted customer portal | deleted (was insecure) | **deferred** |

The strong, defensible half of the product (regulatory/agronomic depth, mapping)
got stronger. The commercial-plumbing half is now half-closed. The four phases
below finish it.

---

## Part 3 — The next 4-phase enhancement package

Named A–D to avoid colliding with the revenue chain's own Phase 1–4 numbering.
A and B complete the already-planned revenue chain; C and D take on the two
biggest remaining audit gaps.

### Phase A — Close the revenue loop (payments + per-job costing)

*This is revenue-chain Phase 3, already specced in
[revenue-chain-implementation.md](revenue-chain-implementation.md) §5.*

**Goal:** money comes in, and Job Costing can finally answer "did we make money on
this job."

- `payments` table (manual recording — cash/check/card/ach label only, **no
  processor, no card data**). Supports partial and multiple payments per invoice;
  invoice status derives from summed payments.
- The `assignments.work_order_id` link (decision O-2) so labor cost reconciles to
  the billed work order → real per-job profit.
- Job Costing gains its revenue side; a work-order selector on the assignment
  editors so the link actually gets populated.

**Why first:** it's the smallest slice that closes the chain end-to-end, unlocks
revenue reporting, and turns Job Costing from half a feature into a whole one. No
payment processor required.

**Effort:** medium. **Risk:** the per-job revenue-attribution wrinkle when one
invoice spans several work orders (documented as R-2).

### Phase B — Recurring & contract billing (the retention feature)

*Revenue-chain Phase 4, specced in the same doc §6.*

**Goal:** define a recurring plan for a property/client and auto-generate its
invoices per period. Lawn maintenance is overwhelmingly seasonal contract work;
this is the feature that makes the app the system of record rather than a tool.

- `service_contracts` + template line items
- A `SECURITY DEFINER` generation function on a schedule (pg_cron or Edge
  Function) — transactional by construction, idempotent via a
  `UNIQUE(contract_id, period_start)` guard
- A `contract_invoice_runs` audit log, because unattended billing needs a paper
  trail

**Why second:** highest customer value, but the most complex and the only phase
with unattended-infra risk (R-9). Enable the schedule only after a manual
"generate now" path is proven against real contracts.

**Effort:** high (schema + infra). **Risk:** unattended generation — get the
pause/end-date logic and idempotency right before the cron is switched on.

### Phase C — Field reliability & capture

**Goal:** stop losing field data, and let crews document work where it actually
happens.

- **Offline write queue** for clock events and task completions. This is the
  audit's highest-severity *field* finding: crews work in dead zones (tree cover,
  rural properties, equipment sheds) and today a dead zone means clock-ins and
  task completions **silently fail** — corrupting payroll, not just annoying.
  Needs a service worker / IndexedDB queue that replays on reconnect.
- **Mobile photo capture** — extend the project-photos pipeline (already built for
  desktop this session) to `MobileFieldWorkspacePage` so crews photograph progress
  in the field. The storage layer and RLS already exist; this is a capture surface.
- **Signature capture** — on-site customer sign-off, which turns a completion into
  billable evidence.

**Why third:** the offline gap is a correctness bug that produces wrong payroll,
so it ranks above most feature work. Photos/signatures ride on infrastructure
already built.

**Effort:** high (offline is genuinely hard; `MobileFieldWorkspacePage` is 1,877
lines). **Risk:** offline sync conflict resolution; test against a production
build, not dev mode.

### Phase D — The customer-facing layer

**Goal:** the business can send things to customers and let them self-serve.

- **Hosted invoice / estimate view** — a tokened public page a client opens to see
  and accept an estimate or view an invoice. MUST use the `SECURITY DEFINER`
  RPC-by-token pattern, **never** a `USING (true)` read policy — the exact bug
  fixed on `clients` this session (cc3fd91). The old `ClientPortalPage` was deleted
  precisely because it predated this rule.
- **Customer notifications** (SMS / email) — "crew is on the way," appointment
  reminders, completion notices with the photos from Phase C, invoice delivery.
  Measurably cuts inbound "where are you?" calls.
- **Client portal** — upcoming visits, invoice history, online acceptance.

**Why last:** it depends on A–C (there's little point emailing an invoice that
can't take a payment, or a completion notice with no photos). It's also the phase
with the most third-party surface (an SMS/email provider) to choose and secure.

**Effort:** medium–high. **Risk:** re-introducing the public-read bug class; every
customer-facing read must go through a token RPC.

---

## Part 4 — Cross-cutting, do-anytime items

These don't need a phase; they're small and independent.

1. **Enable leaked-password protection** (Supabase Auth toggle — owner action).
2. **Exercise the built flows in a browser** — the ten-minute end-to-end run.
   Highest value-per-minute action available right now.
3. **Verify the boundary-edit fix live** (drag a vertex, confirm Save enables).
4. **`auth_rls_initplan`** — 81 advisor findings across the schema (policies
   re-evaluating `auth.uid()` per row). Not a security hole, a scale issue. Worth a
   single deliberate DB-wide pass wrapping the calls as `(select auth.uid())` — but
   only once, schema-wide, not piecemeal, and only when the tables actually have
   volume.
5. **Middleware auth fan-out** — the matcher runs `getUser()` on nearly every
   request and Next prefetches every sidebar link, producing ~30 `/user` calls in
   the seconds after login. Wasteful, harmless, tunable.

---

## Part 5 — Recommended sequencing

```
NOW   Exercise the chain end-to-end (10 min) + flip the password toggle
  │   — proves Phases 1–2 before stacking on them
  ▼
A     Payments + per-job costing        ← finishes the revenue loop, no processor
  ▼
B     Recurring / contract billing      ← the retention feature
  ▼
C     Offline queue + mobile capture    ← fixes the payroll-data-loss bug
  ▼
D     Customer-facing layer             ← depends on A–C
```

**The one non-obvious call:** validate before you build. Every phase from here
stacks on the empty, unexercised revenue tables. A single end-to-end run —
catalog item → client → estimate → accept → invoice → (future) payment — is worth
more than any amount of additional planning, because it's the only thing that
proves the schema and RLS behave under a real signed-in user rather than under
build-time type checking.

If timeline pressure appears, the cut line is clean: **A and C are the
correctness/revenue essentials; B and D are the growth features.** Ship A, prove
it, then decide B vs C by whether the immediate pain is "can't bill recurring
customers" or "losing field clock-ins."
