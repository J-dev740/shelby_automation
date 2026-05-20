# Shelby × WhatsApp Phygital Ordering — Deliverables Index
*Compiled from your NotebookLM knowledge base + PRD + research dossier + market analysis + the two menu boards.*

## How to read this folder (for the owner)

Read in this exact order. Each level builds on the previous and reviews itself before going deeper, exactly as you specified — bubble-down, surgical precision, gap-closure at every level.

| # | File | Purpose | Audience |
|---|---|---|---|
| 1 | [`01_seed.md`](./01_seed.md) | **Seed:** vision, context, KB, risks, success metrics, stack rationale | All — start here |
| 2 | [`02_menu_catalog.md`](./02_menu_catalog.md) | Structured menu (transcribed from both boards), modifier groups, open items for owner sign-off | Owner + engineers |
| 3 | [`03_prd_v2.md`](./03_prd_v2.md) | **Product spec** — synthesized PRD, NFRs, data model, edge cases, 4-week roadmap | Engineers (owner-readable §0, §11, §13) |
| 4 | [`04_deck_L0_macro.md`](./04_deck_L0_macro.md) | **Deck L0** — end-to-end UX in one diagram + the two-lane model | Owner-facing |
| 5 | [`05_deck_L1_components.md`](./05_deck_L1_components.md) | **Deck L1** — each L0 box opened up: Triage, Order Engine, FAQ, Status, Dashboard | Owner + engineers |
| 6 | [`06_deck_L2_micro.md`](./06_deck_L2_micro.md) | **Deck L2** — every "what-if": payment fail, stock collision, rain, internet-down, FCFS, idempotency | Owner + engineers |
| 7 | [`07_owner_presentation.md`](./07_owner_presentation.md) | **Owner deck** — non-technical narrative; the version to walk Shelby through in person | Owner-facing |

## What you can do with this right now

1. **Walk the owner through `07_owner_presentation.md`** — designed for that conversation, no jargon.
2. When they ask "but what if X?" — open `06_deck_L2_micro.md`. Every "what if" they will ask is mapped to a concrete behavior.
3. **Sign-off items** that need owner input live in `02_menu_catalog.md` (open items section) and `07_owner_presentation.md` (Slide 19 decision table).
4. **Engineering can start week 1** the day owner signs off — `03_prd_v2.md` is the contract, schema in §8 is the build target.

## Architectural pillars (one-line summary of each)

1. **Phygital parallelism** — digital lane never replaces the counter, only relieves it.
2. **Determinism for money** — no AI in pricing, totals, or availability.
3. **AI for retrieval only** — FAQ answers from approved Shelby KB, never the open internet.
4. **Event log first, side effects second** — every webhook stored raw before processing.
5. **Adapter layer for vendors** — WhatsApp/payment/LLM swappable without rewrites.
6. **Graceful degradation** — every failure mode has a fallback that keeps the café running.
7. **Order-level fulfillment** — preserves Shelby's 90% First-Come-First-Serve promise.
8. **Idempotency everywhere** — duplicate clicks and re-delivered webhooks never double-charge.

## Pilot kill-switch summary (everything the owner controls without an engineer)

- Per-item availability toggle
- Rain mode
- Dynamic ETA factor (rush thresholds)
- Pause-the-digital-lane (whole-system kill switch)
- Manual chat handoff

## Open decisions for the owner before week 1 (consolidated from `07_owner_presentation.md` Slide 19 + `02_menu_catalog.md`)

- [ ] Confirm Horlicks on Rocks price (likely ₹90 by parallel)
- [ ] Confirm Korean Cream Cheese Bun pricing (Mushroom + Classic) — research mentions them; not on board
- [ ] Confirm modifier surcharges (oat milk +₹50? double-shot +₹20?)
- [ ] Pilot scope: Pickup + FAQ + Pay-at-counter ✓ default
- [ ] Razorpay in pilot? default **No**, add in Phase 3
- [ ] Dine-in tables in pilot? default **No**, add in Phase 1.5
- [ ] Cart cap for unpaid orders default **₹200** — keep or tune
- [ ] Rush ETA threshold default **>15 in PREPARING** — keep or tune

## Stack recommendation (one line each, full rationale in `01_seed.md` §8)

- **WhatsApp:** Meta Cloud API via BSP (Interakt or AiSensy) — official, ToS-safe, template approval handled
- **Backend:** Node.js + Fastify
- **DB + Realtime:** Supabase (Postgres + Realtime channels)
- **Jobs:** BullMQ + Redis (or Upstash QStash)
- **Dashboard:** Next.js + React, runs on any tablet browser
- **AI:** hosted LLM + retrieval over approved Shelby docs (no open-internet)
- **Payments:** Razorpay Payment Links (Phase 3, optional)
- **Hosting:** Vercel (UI) + Render/Railway/Fly (API)

Approx pilot run-rate: **~₹2,000–₹5,000/month** (excluding development).

---

## Source materials referenced

- `shelby-whatsapp-prd.docx` — PRD v1
- `Shelby Research.docx` — research dossier (HSR Layout, brand, ops)
- `ShelbyIssuesAndResolutionscopekb.text` — phygital architecture KB + L0/L1/L2 first draft
- `AI WhatsApp Lead Engine for Indian Local Businesses Depth Analysis & Opportunity Assessment.docx` — market context, competitive landscape, stack patterns
- `Notebookllmchatconvo.text` — your NotebookLM thread (problems list, edge-case Q&A)
- `The_Shelby_Phygital_Blueprint.pptx` — original deck skeleton (text-only export)
- Two menu boards — transcribed into `02_menu_catalog.md`

---

*Built per architect spec: bubble-down (L0 → L1 → L2), each level reviewed before descending, every owner concern from sources closed at one of the three levels (gap-closure checklist at the end of `06_deck_L2_micro.md`).*
