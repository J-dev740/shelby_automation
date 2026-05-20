# DECK L1 — Component Breakdown
*Each box from the L0 macro flow opened up. Five components, each diagrammed and reviewed before we drill to L2.*

> **Reading order:** L0 → L1 (you are here) → L2. Every L1 component below begins with the L0 box it expands.

---

## Component 1 — Entry & Triage (expands L0: "Entry → Bot greets → 4 quick actions")

```mermaid
flowchart TD
  S([QR scan / Insta link / saved chat]) --> S1[WhatsApp opens to<br/>+91-Shelby number]
  S1 --> S2{New customer?}
  S2 -->|Yes| S3[Capture phone in customers table<br/>create session]
  S2 -->|No| S4[Resume / refresh session]
  S3 --> S5[Send welcome template<br/>+ 4 quick-reply buttons]
  S4 --> S5
  S5 --> S6{User taps...}
  S6 -->|Menu / Order| C2((→ Component 2:<br/>Order Engine))
  S6 -->|Question| C3((→ Component 3:<br/>FAQ Engine))
  S6 -->|Status| C4((→ Component 4:<br/>Status Lookup))
  S6 -->|Free text| S7[Intent classifier]
  S7 -->|order intent| C2
  S7 -->|question intent| C3
  S7 -->|low confidence| S8[Show 4 buttons again<br/>+ light nudge copy]

  style S5 fill:#e3f0ff,stroke:#1565c0
  style C2 fill:#fff4e6,stroke:#c8551c
  style C3 fill:#fff4e6,stroke:#c8551c
  style C4 fill:#fff4e6,stroke:#c8551c
```

**Owner-readable description**
- Phone number = identity. No login, no app, no account.
- First-time customer is silently registered; returning customer keeps history.
- Four buttons are always one tap away — even if the user types something weird, we re-offer the buttons.

**Inputs:** WhatsApp inbound webhook
**Outputs:** routed to one of {Order Engine, FAQ Engine, Status Lookup}
**State written:** `customers`, `sessions`, `messages`

---

## Component 2 — Order Engine (expands L0: "Order Pickup / Dine-in")

```mermaid
flowchart TD
  O0([Entry from Triage]) --> O1{Pickup or Dine-in?}
  O1 -->|Pickup| O2[Show category list<br/>only active=true]
  O1 -->|Dine-in| O1a[Ask for table no.<br/>or read from QR payload]
  O1a --> O2
  O2 --> O3[Customer picks category]
  O3 --> O4[Show items in category<br/>only active=true]
  O4 --> O5[Customer picks item]
  O5 --> O6{Has modifier groups?}
  O6 -->|Yes| O7[Walk through groups<br/>enforce min/max]
  O6 -->|No| O8[Add to cart<br/>deterministic price]
  O7 --> O8
  O8 --> O9{Add another?}
  O9 -->|Yes| O2
  O9 -->|No| O10[Show cart summary<br/>+ subtotal + ETA]
  O10 --> O11[Ask name + confirm phone]
  O11 --> O12{Cart total > ₹200?}
  O12 -->|Yes| O13[Force digital payment<br/>Razorpay link only]
  O12 -->|No| O14{Pay now or at counter?}
  O14 -->|Counter| O15[FINAL VALIDATION<br/>re-check availability]
  O14 -->|Razorpay| O13
  O13 --> O15
  O15 --> O16{All items still available?}
  O16 -->|Yes| O17[Create order<br/>order_code, ETA, source=whatsapp]
  O16 -->|No| O18[Strip OOS items<br/>suggest alternative]
  O18 --> O10
  O17 --> O19[Push to dashboard via Realtime]
  O19 --> O20[Send confirmation:<br/>order code + ETA + pay link if applicable]
  O20 --> C5((→ Component 5:<br/>Fulfillment))

  style O15 fill:#ffe9e9,stroke:#c0392b
  style O17 fill:#dff5dd,stroke:#2e7d32
  style O13 fill:#fff4e6,stroke:#c8551c
```

**Why this design**
- **No AI in this entire flow.** Every price, every total, every availability check is deterministic database math.
- **Final validation is the safety net** — between "review cart" and "create order", we re-query availability so a barista's 1-second-ago toggle still wins.
- **₹200 cap on unpaid orders** kills the no-show abuse vector.
- **Order code** is short and human-readable (e.g., `SHL-241`) so it matches what staff already shout at the window.

**Inputs:** triaged session
**Outputs:** confirmed order in DB, customer notification, dashboard push
**State written:** `orders`, `order_items`, `order_item_modifiers`, `order_status_events`, `messages`

---

## Component 3 — FAQ Engine (expands L0: "Ask a Question")

```mermaid
flowchart TD
  F0([Free-text question]) --> F1[Embed query]
  F1 --> F2[Retrieval over<br/>approved Shelby # apps/api/Dockerfile only]
  F2 --> F3{Top match score<br/>≥ threshold?}
  F3 -->|Yes high conf| F4[LLM formats answer<br/>using ONLY retrieved chunks]
  F3 -->|Borderline| F5[Return canned answer<br/>+ 'Talk to staff?' button]
  F3 -->|No| F6[Graceful handoff:<br/>set session to handoff_requested]
  F4 --> F7[Send concise reply<br/>+ 'Order now?' upsell button]
  F5 --> F8{User taps Talk to staff?}
  F8 -->|Yes| F6
  F8 -->|No| F7
  F6 --> F9[Ping dashboard<br/>conversation surfaces in handoff column]

  style F2 fill:#e3f0ff,stroke:#1565c0
  style F6 fill:#ffe9e9,stroke:#c0392b
  style F4 fill:#dff5dd,stroke:#2e7d32
```

**Pre-loaded KB chunks (must-have on day 1)**
- Hours of operation
- Exact location + parking note
- Vegan / oat milk availability + surcharge
- Payment modes (cash, UPI, card?)
- "Must-try" recommendations (Coffees, Hot Chocolate, Lemon Honey — straight from the board)
- Allergens / nut-free options
- **Rain protocol** ("It's raining, but our window is open!")
- Crowd / wait expectation
- Whether food (Korean Buns) is available today

**Owner-readable rules**
- Bot **never** answers from the open internet.
- Borderline questions get the canned "I'll connect you" path — bot is conservative on purpose.
- Every FAQ answer is tagged with the source document version, so the owner can audit later.

**Inputs:** free-text customer message
**Outputs:** concise reply, OR handoff to staff
**State written:** `messages`, `sessions.state` (may flip to `handoff_requested`)

---

## Component 4 — Status Lookup (expands L0: "Check Order Status")

```mermaid
flowchart TD
  T0([User taps 'Check status']) --> T1[Lookup customers.phone_e164]
  T1 --> T2{Active order found?<br/>status NOT in 'completed','cancelled'}
  T2 -->|1 active| T3[Return state + revised ETA<br/>+ 'I'll ping you when ready' line]
  T2 -->|>1 active| T4[Show short list with codes]
  T2 -->|None| T5[Ask 'Type order code or place new order']
  T4 --> T6[User picks one]
  T6 --> T3
  T3 --> T7{State?}
  T7 -->|new/accepted| T8[Soft 'in queue' copy]
  T7 -->|preparing| T9[Honest ETA based on dynamic_eta_factor]
  T7 -->|ready| T10[Tell user to step up to window now]

  style T10 fill:#dff5dd,stroke:#2e7d32
```

**Inputs:** session, phone
**Outputs:** read-only status reply
**State written:** none (read-only path)

---

## Component 5 — Fulfillment & Staff Dashboard (expands L0: "Dashboard → Status updates → Window")

```mermaid
flowchart LR
  subgraph DASH["Staff Dashboard (tablet)"]
    direction TB
    K1[NEW] --> K2[ACCEPTED]
    K2 --> K3[PREPARING]
    K3 --> K4[READY]
    K4 --> K5[COMPLETED]
    K2 -.cancel.-> KX[CANCELLED]
    K3 -.cancel.-> KX
    K1 -.cancel.-> KX
  end

  ORD[Order created] --> K1
  K2 --> N1[Send 'we got it' ping]
  K3 --> N2[Optional 'now preparing' ping]
  K4 --> N3[Send 'READY — step up' ping]
  K5 --> N4[Optional thank-you ping]

  AVAIL[Availability toggle] -.controls.-> MENU[(menu_items.active)]
  HANDOFF[Handoff column] -.surfaces.-> CHAT[Conversation view<br/>with takeover]

  style K4 fill:#dff5dd,stroke:#2e7d32
  style KX fill:#ffe9e9,stroke:#c0392b
  style HANDOFF fill:#fff4e6,stroke:#c8551c
```

**Why Kanban (and not "auto-sequence")**
- The assembly line at Shelby is a *human* optimization. The dashboard is an **information radiator**, not a dispatcher.
- Staff sees aggregate demand (e.g., "5 teas in PREPARING across 3 orders") and batches naturally.
- Order moves to **READY** only when the *whole* order is built → preserves FCFS, prevents window crowding.

**Dashboard surfaces (one screen, four tabs)**
1. **Orders board** — Kanban, default view
2. **Menu availability** — one-tap toggle list, sorted by today's velocity
3. **Conversations / handoff** — chats flagged for human takeover
4. **Today** — orders count, avg ETA delta, FAQ deflection %, manual interventions

**Inputs:** confirmed orders from Order Engine, handoff flags from FAQ Engine
**Outputs:** customer notifications, status events
**State written:** `orders.status`, `order_status_events`, `menu_items.active`, `sessions` (when staff takes over)

---

## Cross-component infrastructure (the plumbing under all 5)

```mermaid
flowchart TD
  IN[Inbound webhook<br/>WhatsApp + Razorpay] --> SIG[Signature verify]
  SIG --> RAW[(raw events table<br/>messages_raw)]
  RAW --> NORM[Normalize → internal event]
  NORM --> DEDUP{Already seen<br/>provider_event_id?}
  DEDUP -->|Yes| DROP[Drop silently]
  DEDUP -->|No| QUEUE[BullMQ job]
  QUEUE --> PROC[Component 1-5 handlers]
  PROC --> AUDIT[(orders, sessions, messages,<br/>order_status_events)]
  AUDIT --> RT[Supabase Realtime]
  RT --> DASH[Dashboard]

  style SIG fill:#ffe9e9,stroke:#c0392b
  style DEDUP fill:#ffe9e9,stroke:#c0392b
  style AUDIT fill:#e3f0ff,stroke:#1565c0
```

This plumbing is what makes the whole system **idempotent and replayable**. If WhatsApp re-delivers a webhook, we drop it. If a job crashes, we re-run it. If a dispute arises, we replay events from the raw log.

---

## Architect's Review — L1 (before going to L2)

**What the L1 view confirms:**
- The 5 components are **loosely coupled** — Order Engine doesn't know about FAQ Engine, FAQ Engine doesn't know about Dashboard. They communicate through the database + realtime channel.
- The **deterministic core** (Order Engine, Status Lookup, Dashboard) is fully separable from the **probabilistic edge** (FAQ Engine). If the LLM provider has an outage, ordering keeps working.
- Each component has a clear **single responsibility** and a clear **state boundary**.

**Two L1 decisions worth highlighting for the owner:**
1. **Final validation right before order creation** is the single most important micro-design choice. It is the reason "out-of-stock collisions" don't become refund headaches.
2. **Handoff is a state, not an interrupt.** When a customer needs a human, the bot goes silent and the chat surfaces in a dashboard column — staff doesn't get phone notifications, they just glance at the column. This matches Shelby's calm-amid-chaos operating style.

**Risks surfaced at L1 (carried forward to L2):**
- What happens if the dashboard is offline when an order arrives? *(answered in L2 micro-flow 5)*
- What happens if a customer abuses free-text? *(rate limit + spam guard at L2)*
- What about duplicate clicks on a button? *(idempotency at L2)*
- What if a payment webhook arrives *before* the order is created? *(out-of-order events at L2)*

→ Drilling into L2: each unhappy path mapped, every state transition diagrammed, every safety net wired.
