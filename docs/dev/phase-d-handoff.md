# Phase D — Customer-Facing Layer: Decision Handoff

> Prepared: 2026-07-27 · HEAD `db9fafc` · For decisions before any code.
> Same shape as [revenue-chain-handoff.md](revenue-chain-handoff.md): frame the
> forks, ground them in the live state, and flag what needs your call (and your
> credentials) before building. Phase D is the last of the four-phase roadmap
> ([roadmap-next-4-phases.md](roadmap-next-4-phases.md) §Phase D).

---

## The one-paragraph goal

The business can now quote, bill, take payment, and bill recurring — but all of
it is **internal**. Phase D lets the business *reach the customer*: send them
things (reminders, "on the way," completion notices, invoices) and let them
self-serve (view/accept an estimate, see invoice history). It's the phase that
turns the revenue chain outward.

## Why it's last, and why it needs decisions first

- It **depends on Phases A–C**: little point emailing an invoice that couldn't
  take a payment, or a completion notice with no photos/signature.
- It has the **most third-party surface** (an SMS/email provider) — a choice that
  brings a credential I can't provision and a package that needs your approval.
- It's **security-sensitive**: any customer-facing read must go through a
  `SECURITY DEFINER` RPC keyed by a token, **never** a `USING (true)` policy —
  the exact bug I dropped on `clients` (cc3fd91). The old `ClientPortalPage` was
  deleted precisely because it predated that rule.

---

## Current state (verified)

| Piece | State |
|---|---|
| `clients` | Table exists, org-scoped, **0 rows**. No portal. |
| `invoices` / `estimates` | Real, billable, itemized, linked to a client. |
| Payments | Manual recording only — **no processor** (deliberate, Phase A). So "pay online" is NOT available without new work. |
| Signatures / photos | Exist (Phase C) — available as completion evidence to attach to notices. |
| Notifications (SMS/email) | **None.** No provider, no send path anywhere. |
| Hosted customer view | **None** (the insecure portal was deleted). |
| The token-RPC pattern | Not built yet — this is the required mechanism for any public read. |

---

## The decisions (this is the point)

### D-1 — Notification channel + provider

The biggest fork; everything about sending depends on it.

- **Channel:** SMS, email, or both? SMS has far higher open rates for "crew is on
  the way / appointment reminder"; email suits invoice delivery and longer
  content. Many field-service apps do SMS for time-sensitive, email for documents.
- **Provider (needs YOUR account + a credential I cannot provision):**
  - SMS: **Twilio** (default), or the SMS side of a unified provider.
  - Email: **Resend** (simple, modern), **Postmark** (great deliverability for
    transactional), or **SendGrid**.
- **Package:** whichever provider = a new npm dependency, which needs your
  approval (CLAUDE.md). Sends should go through a **server route / Edge Function**
  holding the API key — never the browser.
- **Assistant boundary:** I can build the integration, but I must not *send live
  messages on your behalf* or enter provider credentials. You provision the key;
  a human triggers the first real sends.

**Recommendation to weigh:** start with **email via Resend** for invoice/estimate
delivery (lowest-friction, one key, document-shaped), and add **SMS via Twilio**
for reminders as a second step. Decide channel + provider before build.

### D-2 — Hosted invoice / estimate view (the security-critical one)

A tokened page a customer opens (no login) to see an estimate or invoice.

- **Mechanism (non-negotiable):** a `SECURITY DEFINER` RPC that takes the token
  and returns exactly one record. **No `USING (true)` read policy on any revenue
  table.** This is the cc3fd91 lesson; getting it wrong exposes every customer's
  billing across all orgs.
- **What can the customer *do* there?**
  - View — always.
  - **Accept an estimate** — feasible (the accept→convert function already
    exists; a tokened accept would call a guarded variant).
  - **Pay** — NOT available in v1, because there's no payment processor (Phase A
    was manual-only by decision). "Pay online" would require going back and adding
    a processor. Flag if you want it; otherwise the hosted view is view + accept.

**Recommendation:** hosted **view + accept-estimate** in v1, via token-RPC. No
online pay until/unless a processor is added.

### D-3 — Client portal scope

A light logged-in-or-tokened area: upcoming visits, invoice history, online
acceptance. This is essentially D-2 plus history, and it depends on `clients`
actually being populated (still 0 rows).

**Recommendation:** treat the portal as a follow-on to D-2 — the tokened
view/accept is the useful 80%; a full portal only earns its keep once clients and
invoices have real volume.

---

## Constraints any Phase D build must respect

- **Token-RPC only** for customer reads; never `USING (true)` (cc3fd91).
- **No processor / no online pay** in v1 (Phase A decision). Don't let a hosted
  "pay" button imply one exists.
- **Provider key lives server-side** (route/Edge Function), never in the browser
  bundle.
- **Assistant won't send live messages or provision credentials** — I build the
  path; you supply the key and make the first real send.
- **Rule 8:** customer-facing copy stays plain; no dev/tech vocabulary.
- **Sending on the user's behalf / standing integrations** are permissioned
  actions — the first real send and any auto-send rule are your explicit call.

---

## Suggested sequencing within Phase D

```
D-2  Hosted invoice/estimate view (token-RPC) + accept-estimate   ← security-critical, no 3rd party
  ▼
D-1a Email delivery via chosen provider (invoice/estimate send)   ← needs your provider + key
  ▼
D-1b SMS reminders ("on the way", appointment)                    ← needs Twilio + key
  ▼
D-3  Client portal (history) once clients have real volume
```

D-2 needs no third-party and no credential — I can build and validate it
(token-RPC) the same rolled-back way as the revenue chain. So it's the natural
first step while you decide the provider for D-1.

## What I need from you to start

1. **D-1 provider decision** — channel (SMS/email/both) and provider(s). You'll
   also need to create the account + API key when we reach the send path.
2. **D-2 confirm** — hosted view = **view + accept-estimate**, no online pay (or
   tell me you want to add a processor first).
3. **D-3** — portal now or deferred (I recommend deferred).

Settle D-2 and I can start it immediately (no credential needed); the provider
decision can follow before D-1.
