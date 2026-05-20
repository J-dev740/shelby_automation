# PRD v2 — Shelby WhatsApp Phygital Ordering System

> **Source basis:** synthesizes `shelby-whatsapp-prd.docx` (PRD v1) + `ShelbyIssuesAndResolutionscopekb.text` (phygital architecture KB) + research dossier + menu boards. This document is owner-facing where possible, engineering-precise where required.

---

## 0. TL;DR for the owner

- We add a **WhatsApp lane** beside your counter. A QR sticker on your window/sidewalk opens a chat with Shelby.
- The bot **answers questions, takes orders, gives a real prep-time estimate, and tells the customer when their order is ready**.
- Inside the kiosk, your staff sees orders on a tablet (the **dashboard**) like a Kanban board: *New → Accepted → Preparing → Ready*.
- **Nothing changes for walk-ins.** Cash, no-WhatsApp, internet-down — all still work the old way.
- **Pilot launches in 4 weeks** with pickup + FAQ. Dine-in and digital payments come after.

---

## 1. Goals & success metrics (locked from PRD v1)

| # | Goal | Metric | Target |
|---|---|---|---|
| G1 | Reduce counter friction at peak | Avg counter order-taking time during peak | **−25%** |
| G2 | Channel shift | % peak-hour orders via WhatsApp by week 4 | **≥20%** |
| G3 | Order accuracy | Error rate on WhatsApp orders | **<3%** |
| G4 | Bot speed | Median time-to-first-response | **<10s** |
| G5 | FAQ deflection | FAQ chats resolved without staff | **≥70%** |

Owner-visible additions:
- Counter dwell time per customer (target trend down)
- ETA promised vs. actual delta (target ≤ ±20%)
- Repeat-customer share (proxy for delight)

---

## 2. Scope

### 2.1 In scope (MVP, 4 weeks)
- WhatsApp entry via QR (sidewalk, counter, takeaway point) and Instagram link
- **Intent classifier** at the front door routing every inbound message into one of **four flows**: `FAQ`, `Order`, `Status`, `Handoff` (see §4.0). Cheap-first heuristics (button payloads + keyword rules); LLM only as fallback at low confidence.
- **Structured-only ordering at MVP** — interactive lists, quick replies, and buttons drive the entire order flow. **Natural-language ordering is explicitly deferred to Phase 2** (after Flow 2 is battle-tested in production).
- Menu browse by category (auto-fed from the 11 categories in `02_menu_catalog.md`)
- Guided **pickup** order flow with cart, modifiers, totals, ETA
- **Per-item customer notes** (e.g., "less sugar", "extra hot", "with honey") and **order-level notes** (e.g., "no straw, eco-friendly please") — free-text, length-capped, profanity-filtered, surfaced prominently on the kitchen dashboard.
- Optional **dine-in** flow with table number (Phase 1.5 — gate after pickup proves out)
- FAQ engine over an approved Shelby knowledge base (retrieval only)
- Order confirmation + status updates: New / Accepted / Preparing / Ready / Cancelled / Completed
- **Real-time staff dashboard** with Kanban board, order detail drawer, availability toggles, **note-aware order cards**
- Outbound notifications: confirmation, ready, handoff
- Manual takeover / staff-handoff path
- Optional Razorpay payment links (week 3 onward, can be deferred)
- Audit log of every webhook + every status change

### 2.2 Out of scope (MVP)
Delivery, loyalty, marketing campaigns, full POS, voice ordering, broad multilingual AI, KDS hardware integration, **natural-language order capture (Phase 2)**, **AI-powered upsell / recommendations (Phase 2+)**.

---

## 3. Personas

| Persona | What they need |
|---|---|
| **Customer (digital)** — tech worker, late-night cruiser | Skip the line, see honest ETA, get notified when ready |
| **Customer (walk-in)** — cash-only / no-WhatsApp | Be served the traditional way, no friction added |
| **Staff (assembly line)** — order-taker, frothing barista, shot-puller, bun-station | One screen with one queue; one-tap availability toggles |
| **Owner (Shelby)** — non-technical operator | Confidence the system fails gracefully, dashboards prove ROI |

---

## 4. User journeys (PRD-aligned)

### 4.0 Intent classifier (the front door — Flow 0)
Every inbound message is first routed by a **deterministic-first, LLM-fallback** classifier into exactly one of the four flows below. This decouples NLU complexity from order correctness.

**Routing layers (cheapest first):**
1. **Button / list payload match** — if the inbound has a structured `button_reply` or `list_reply` ID we issued, classification is exact and free. Covers ~80% of MVP traffic.
2. **Keyword rules** — small curated list per intent (e.g., "status", "where is my order", "ready?" → `Status`; "open?", "vegan", "parking" → `FAQ`; "talk to staff", "human", "help" → `Handoff`).
3. **Session-state hint** — if the user is mid-cart (`ordering_*` state), unrecognized free-text is treated as a `Handoff` candidate (because we are NOT doing NL ordering at MVP). Bot replies with a clarifying button menu rather than guessing.
4. **LLM tiebreaker** — only when steps 1–3 are inconclusive AND confidence is low. Returns one of the 4 labels with a confidence score; below threshold ⇒ `Handoff`.

**The four flows:**
| Flow | Trigger | Owner of correctness |
|---|---|---|
| **F1: FAQ** | "Are you open?", "Vegan milk?", "Parking?" | Retrieval engine over approved KB |
| **F2: Order** | Tap **Order Pickup** / **Order Dine-in** button | Deterministic state machine + cart engine |
| **F3: Status** | Tap **Check status** or matches "where is my order" | DB lookup by phone or `order_code` |
| **F4: Handoff** | Tap **Talk to staff**, low-conf input, or repeated misclassification | Staff dashboard takes over the conversation |

> **MVP rule:** if a user types free-text *while the session state is in any `ordering_*` state*, the bot does NOT attempt to parse it as an item. It re-renders the current step's buttons and silently logs the message for Phase 2 NL training data.

### 4.1 FAQ
Customer opens chat → bot shows 4 quick replies → customer asks "Vegan milk?" → bot retrieves answer from approved KB → if confidence high, replies in <10s; if low, hands off to staff.

### 4.2 Pickup order
Customer taps **Order Pickup** → category list → item → modifiers → **optional per-item note prompt** ("Anything special for this drink? — Skip / Add note") → cart → **optional order-level note prompt** ("Anything for the whole order? — Skip / Add note") → name+phone confirm → order ID + ETA → optional pay-link or "pay at counter" → status pings → "Ready, step up to window".

### 4.3 Dine-in (Phase 1.5)
Customer scans table QR → table number auto-captured → rest mirrors pickup → ticket marked **DINE-IN T-12**.

### 4.4 Order status
Customer taps **Check status** → bot finds active order by phone or ID → returns current state + revised ETA.

### 4.5 Walk-in (unchanged, explicitly preserved)
Customer at window → speaks to barista → cash or UPI → traditional fulfillment. Digital lane runs *parallel*, never replaces.

---

## 5. Functional requirements

### 5.1 Messaging
- Inbound webhook from WhatsApp (Cloud API or BSP) with signature verification.
- Idempotent processing (dedupe by provider message ID).
- Per-phone session state with 30-min dormancy timeout.
- Quick replies / list menus / buttons used wherever supported.
- Manual takeover flag flips bot to silent mode and surfaces full chat to staff.

### 5.2 FAQ engine
- Retrieval over an **approved** Shelby document set only. No open-internet generation.
- Confidence threshold → if below, fallback to staff handoff.
- Versioned answer source for audit.
- Pre-loaded entries: hours, location, vegan/oat milk, payment modes, parking, **rain protocol**, "fastest drink", "must-try", allergens.

### 5.3 Menu / catalog
- Categories, items, modifier groups, modifiers (see `02_menu_catalog.md`).
- `active` flag at item and modifier level — single source of truth.
- `prep_time_min` per item; cart ETA = max(item prep) + queue inflation factor.

### 5.4 Ordering engine — **deterministic**
- Cart math is server-side, never AI-generated.
- Modifier validity enforced (min/max select per group).
- **Customer notes (per-item and per-order):**
  - Free-text, **max 80 chars** per item note, **max 140 chars** per order note.
  - Sanitized: trim, strip control chars, profanity filter (deny-list), URL stripping.
  - Stored verbatim post-sanitization on `order_items.customer_note` and `orders.customer_note`.
  - Notes are **advisory only** — they NEVER alter price, modifier set, or availability. If a note implies a billable change (e.g., "add extra shot"), the system replies: *"Got it — for an extra shot please tap **+ Modifier** on the cart."*
  - Bot offers **one-tap quick notes** to reduce typing: `Less sugar` · `No sugar` · `Extra hot` · `Less ice` · `With honey` · `Custom…` (opens free text).
- Cart cap **₹200** for unpaid orders (anti-fake-order); above ⇒ digital payment required.
- Final cart **re-validated against live availability** at confirm-time.
- Generates `order_code` (short, human-readable) + UUID `id`.
- Stores `source = whatsapp`.

### 5.5 Staff dashboard
- Login + RBAC (staff / admin).
- Kanban: **New → Accepted → Preparing → Ready → Completed** + **Cancelled**.
- Live updates via Supabase Realtime, P95 push <2s.
- **Note-aware order cards** — customer notes are surfaced at *card level*, not buried in a drawer:
  - Each item line shows its note inline, **icon + colored chip** (e.g., 🟡 *less sugar*, 🔵 *with honey*).
  - Order-level note pinned as a **yellow banner** at the top of the card.
  - If any item has a note, the card shows a 📝 badge so the assembly line spots it before tapping in.
  - Print/print-preview view groups notes per station (tea station sees only tea-related notes, etc. — Phase 1.5).
- Order detail drawer: items, modifiers, customer name+phone, **full notes**, status history.
- Availability toggle per item (single tap).
- Manual resend of customer notification.
- Conversation view + handoff control.
- Basic analytics: orders today, avg ETA delta, FAQ deflection rate, **note-frequency report** (top 10 most-used notes — feeds Phase 2 modifier candidates).

### 5.6 Notifications
- Order confirmation (with order code, ETA, optional pay link)
- Status: Accepted / Preparing / Ready
- Handoff to staff
- ETA inflation message during rush
- Rain protocol broadcast (manual trigger by staff)

### 5.7 Payments (optional, Phase 3)
- Razorpay Payment Link per order
- Webhook updates `payment_status`
- "Pay at counter" remains the default option

---

## 6. Non-functional requirements
- Idempotent webhooks, P95 <2s for non-AI handlers
- Audit trail for orders + status events
- All secrets in env vars
- Graceful degradation: AI down ⇒ static FAQ + handoff; dashboard offline ⇒ verbal at counter; payment provider down ⇒ pay-at-counter only
- No AI in pricing, totals, or availability decisions
- Basic monitoring: webhook failures, queue lag, send errors

---

## 7. System architecture

```
[Customer WhatsApp] ──▶ [BSP / Meta Cloud API]
                               │ (HTTPS POST webhook)
                               ▼
                  ┌──────────────────────────────┐
                  │  Webhook Gateway             │  ← Fastify, Node.js
                  │  • verify signature          │     LOCAL DEV: ngrok tunnel
                  │  • dedupe (provider msg_id)  │     → Meta / BSP webhook URL
                  │  • persist raw payload       │
                  │  • return 200 OK in <500ms   │
                  └──────────────────────────────┘
                               │ enqueue
                               ▼
                  ┌──────────────────────────────┐
                  │  Async Job Queue (BullMQ)    │  ← Redis (Upstash in prod)
                  └──────────────────────────────┘
                               │ worker pulls
                               ▼
                  ┌──────────────────────────────┐
                  │  Intent Classifier (§4.0)    │  ← buttons → keywords → state → LLM
                  └──────────────────────────────┘
                               │ routes to one of 4 flows
                               ▼
                  ┌──────────────────────────────┐
                  │  Orchestrator / State Machine│  ← XState or hand-rolled FSM
                  └──────────────────────────────┘
                   ├─▶ [FAQ Retrieval Service]   ──▶ [LLM Provider (Gemini / GPT)]
                   ├─▶ [Menu Service]            ──▶ [Postgres (Supabase)]
                   ├─▶ [Cart/Order Service]      ──▶ [Postgres (Supabase)]
                   │      • deterministic pricing
                   │      • notes sanitizer
                   │      • availability re-check
                   ├─▶ [Status Service]          ──▶ [Postgres (Supabase)]
                   ├─▶ [Payment Service]         ──▶ [Razorpay] (Phase 3)
                   └─▶ [Notification Service]    ──▶ [BSP send API]
                                                       │
                  [Supabase Realtime] ◀────────────────┘ (Postgres LISTEN/NOTIFY → WS)
                               │
                               ▼
                  ┌──────────────────────────────┐
                  │  Staff Dashboard             │  ← Next.js + React
                  │  Kanban + note-aware cards   │     deployed on Vercel
                  └──────────────────────────────┘
```

**Adapter interfaces (provider-agnostic):**
- `MessagingProvider.sendMessage / parseWebhook` — swap Meta Cloud API ↔ Twilio ↔ Interakt ↔ AiSensy without touching business logic.
- `PaymentProvider.createPaymentLink / parseWebhook` — Razorpay today, others later.
- `LLMProvider.classifyIntent / generateFaqAnswer` — Gemini, GPT, or local; both calls behind one interface.

**Local DX (ngrok-driven):**
- `ngrok http 3000` exposes the Fastify webhook gateway.
- Paste the public URL into Meta Developer Console / BSP webhook config.
- ngrok **Traffic Inspector** lets devs *replay* any captured payload with one click — no need to send real WhatsApp messages from a phone to retest a parser change.
- A `tools/replay.ts` script also bulk-replays last 24h of captured payloads against the local server (regression harness).

---

## 8. Data model

Tables: `customers`, `sessions`, `menu_categories`, `menu_items`, `modifier_groups`, `modifiers`, `orders`, `order_items`, `order_item_modifiers`, `order_status_events`, `messages`, `faq_documents`, `staff_users`. Field-level definitions: see PRD v1 / `_extracted/shelby-whatsapp-prd.txt` lines 159–259.

**Schema additions (PRD v2):**
- `orders.customer_note` (text, nullable, ≤140 chars, sanitized) — order-level note shown as yellow banner on dashboard.
- `order_items.customer_note` (text, nullable, ≤80 chars, sanitized) — per-item note shown as inline chip on dashboard.
- `orders.dynamic_eta_factor` (numeric, default 1.0) — populated when system inflates ETA under rush.
- `orders.intent_route` (text) — which flow handled this (`order` for Flow 2; helpful for analytics).
- `messages.classified_intent` (text) — `faq | order | status | handoff | unknown` from §4.0 classifier.
- `messages.classifier_confidence` (numeric 0–1) — for monitoring + Phase 2 NL training.
- `menu_items.low_stock` (bool, optional Phase 2).
- `system_settings` (key/value table) — global flags: `rain_protocol_active`, `digital_lane_paused`, `rush_threshold`, `eta_inflation_factor`.

---

## 9. State machine

**Session states:** `idle, classifying, faq, ordering_select_type, ordering_select_category, ordering_select_item, ordering_select_modifiers, ordering_item_note, ordering_review_cart, ordering_order_note, ordering_collect_identity, ordering_payment_pending, ordering_confirmed, status_lookup, handoff_requested`.

> Two new states for notes: `ordering_item_note` (after modifiers, before "Add to cart") and `ordering_order_note` (after cart review, before identity capture). Both are **skippable** with one tap.

**Order states:** `new → accepted → preparing → ready → completed`, with `cancelled` reachable from any state up to `ready`.

Transitions, timeouts, and reverse paths are diagrammed in `06_deck_L2_micro.md`.

---

## 10. Edge cases (the phygital layer — owner's biggest concerns)

| # | Scenario | System behavior |
|---|---|---|
| E1 | Customer has **no WhatsApp** | Walks up, orders verbally — system untouched |
| E2 | Customer prefers **cash** | Picks "pay at counter" in chat or just walks up |
| E3 | **UPI fails** mid-checkout | After 5 min, bot nudges: "Confirm now, pay cash at window" |
| E4 | **Internet drops** in kiosk | Dashboard shows offline banner; staff revert to verbal at window; physical fulfillment never blocks |
| E5 | **Item sells out** while in cart | Final-confirm webhook re-checks availability, strips item, suggests alternative |
| E6 | **Tea batching vs. coffee** during rush | Dashboard shows aggregate "Preparing" — staff batch teas/coffees naturally; system never sequences for them |
| E7 | **Multi-item order, FCFS preserved** | Status flips to **Ready** only when whole order is built; customer steps up once |
| E8 | **Rush ETA inflation** | If `Preparing` count > 15, new orders get inflated ETA copy |
| E9 | **Fake/no-show** large cart | Cart >₹200 unpaid is blocked; must pay digitally upfront |
| E10 | **Dormant chat** (>30 min) | Session auto-clears; graceful "Welcome back" restart |
| E11 | **Rain protocol** | Owner toggles flag on dashboard; bot prepends weather copy to all replies; FAQ has dedicated answer |
| E12 | **Duplicate webhook / double tap** | Idempotency keys reject twins silently |
| E13 | **Wrong number / spam** | Rate limit per phone; silent drop after threshold |
| E14 | **Owner wants to pause digital lane** | Single toggle in `system_settings.digital_lane_paused` — bot replies "We're a bit slammed, please walk up to the window" |

---

## 11. Roadmap (4 weeks, locked)

| Week | Theme | Output |
|---|---|---|
| 1 | Foundation | Schema in Supabase, webhooks live, raw event logging, dashboard shell + auth |
| 2 | Order engine | Menu browse + cart + order creation + Kanban + realtime + availability toggles |
| 3 | AI + payments + hardening | FAQ retrieval, low-conf handoff, Razorpay, idempotency, retries, message templates |
| 4 | Pilot | Internal test → off-peak shadow → weekend peak pilot → metrics + bug triage + SOPs |

Pilot **launch with pickup + FAQ + pay-at-counter only** (smallest blast radius). Dine-in and Razorpay layered after.

---

## 12. Risks & mitigations (consolidated)

| Risk | Severity | Mitigation (built-in) |
|---|---|---|
| Kitchen is the real bottleneck, not order-taking | High | Measure counter time vs. kitchen time separately during pilot; channel shift relieves counter regardless |
| AI hallucinates wrong info | High | Retrieval-only, confidence threshold, no AI in pricing |
| Menu drift | High | Single-source availability flag, one-tap toggle |
| Provider lock-in (BSP, Razorpay) | Medium | Adapter layer |
| Payment confusion at pilot launch | Medium | Launch pay-at-counter only |
| Fake/no-show orders | Medium | Cart cap for unpaid |
| Bengaluru rain | Medium | Rain protocol FAQ + dashboard toggle |
| Encroachment / public nuisance complaints | Medium | WhatsApp lane physically thins crowd at sidewalk |
| Staff resistance | Medium | Dashboard mirrors existing assembly-line mental model; no new "POS" |

---

## 13. SOPs (operational, owner can post on the kiosk wall)

1. Open dashboard at start of shift; check connectivity light is green.
2. Update **availability** before every rush window (e.g., "Korean Bun out — toggle off").
3. One designated staff owns **manual handoff** chats during rush.
4. Every cancelled order requires a **reason code**.
5. End-of-day: 5-minute review of failed chats + wrong orders + ETA delta.
6. If internet drops > 5 min: announce "we're on verbal orders for a few minutes" and continue.
7. Rain starts: toggle **Rain Protocol** in settings.

---

## 14. Production-readiness checklist (gate to scale beyond pilot)

- [ ] Adapter layer complete and tested with mock providers
- [ ] Webhook signatures verified (WhatsApp + Razorpay)
- [ ] Idempotency keys on every event handler
- [ ] Order audit log queryable
- [ ] Dashboard role separation
- [ ] Monitoring on webhook failures, queue lag, send errors
- [ ] Incident runbook documented (rollback, rain mode, payment-provider outage)

---

## 15. Go-live recommendation
**Launch with pickup + FAQ + pay-at-counter.** Validate decongestion and ETA accuracy before adding dine-in tables and Razorpay. Operational change stays small; signal-from-noise stays clean.

---

## 16. Canonical tech stack (locked for MVP)

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Mature ecosystem, async I/O fits webhook workload |
| HTTP framework | **Fastify** | Higher throughput than Express; schema-validated routes; first-class TypeScript |
| Language | **TypeScript (strict)** | Compile-time safety on cart math, state transitions, payload shapes |
| Messaging | **Meta WhatsApp Cloud API** (or BSP: Interakt/AiSensy) | Official, supported, no scraping risk; **NEVER `whatsapp-web.js`** |
| Local tunnel | **ngrok** with **Traffic Inspector** | Public HTTPS for webhooks; one-click payload replay |
| Async queue | **BullMQ** on **Redis** (Upstash in prod) | Webhook returns 200 in <500ms; processing happens in worker; retries + DLQ |
| Database | **Supabase Postgres** | Managed; CLI for local dev; RLS available; no schema lock-in (it's just Postgres) |
| Realtime | **Supabase Realtime** | Postgres LISTEN/NOTIFY → WebSocket; staff dashboard updates <2s |
| State machine | **XState** (or hand-rolled FSM) | Visualizable, testable, deterministic transitions |
| LLM | **Gemini API** or **OpenAI** behind `LLMProvider` adapter | Used ONLY for FAQ retrieval-augmented answers + intent classifier fallback |
| Payments | **Razorpay Payment Links** (Phase 3) | Indian market standard; pay-at-counter remains default |
| Frontend (dashboard) | **Next.js 14 + React + Tailwind** | Component-driven, SSR for auth, deploys on Vercel free tier |
| Backend hosting | **Render / Railway / Fly.io** | Always-on container needed for BullMQ workers (NOT serverless) |
| Frontend hosting | **Vercel** | Native Next.js fit |
| Observability | **Pino** logs + **Better Stack / Datadog** | Webhook failures, queue lag, send errors |
| Testing | **Vitest** + **supertest** + **ngrok payload replay** | Unit + integration + real-payload regression |

**Explicitly rejected:**
- `whatsapp-web.js`, `Baileys`, any unofficial scraper — Meta will block the number; no SLA.
- Express (lower throughput vs. Fastify).
- AWS Lambda for webhook gateway (cold starts + BullMQ workers need persistent connection).
- Any architecture that puts the LLM in the cart/pricing path.

> **Phase 1 sub-pipeline (Flow 2 only) detailed in `08_phase1_order_fulfillment.md` — that document is the surgical execution plan for production-ready order fulfillment.**
