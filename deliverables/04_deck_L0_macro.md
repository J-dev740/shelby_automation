# DECK L0 — Macro / End-to-End UX Flow
*The 10,000-foot view. One picture, three phases, four customer paths. This is what the owner sees first.*

---

## Slide 1 — The headline

> **One QR. One chat. Same window. One less line.**
>
> A customer scans a QR (sidewalk / counter / table / Instagram), chats with Shelby on WhatsApp, places an order, and steps up to the window only when their drink is ready. Everything else (cash, walk-in, no-WhatsApp) keeps working exactly as it does today.

---

## Slide 2 — End-to-end flow (single diagram)

```mermaid
flowchart TD
  A([Customer arrives or sees Insta link]) --> B{Entry point}
  B -->|Sidewalk QR| C[WhatsApp chat opens with Shelby]
  B -->|Table QR<br/>Phase 1.5| C
  B -->|Instagram link| C
  B -->|Walks up| Z[Counter — verbal order<br/>UNCHANGED]

  C --> D[Bot greets &<br/>shows 4 quick actions]
  D --> E{Customer intent}
  E -->|Ask a question| F[FAQ Engine]
  E -->|Order pickup| G[Order Engine — Pickup]
  E -->|Dine-in| H[Order Engine — Dine-in]
  E -->|Check status| I[Status Lookup]

  F --> F1{Confidence?}
  F1 -->|High| F2[Concise answer in <10s]
  F1 -->|Low| HX[Handoff to staff]

  G --> J[Cart + Modifiers + Identity]
  H --> J
  J --> K[Deterministic total + ETA + Order ID]
  K --> L{Pay now?}
  L -->|Pay at counter| M[Confirmed]
  L -->|Razorpay link<br/>Phase 3| L1[Pay link sent]
  L1 --> M

  M --> N[Staff Dashboard receives order<br/>Realtime push <2s]
  N --> O[Status: New → Accepted → Preparing → Ready]
  O --> P[WhatsApp ping: Your order is ready]
  P --> Q([Customer steps up to window])

  I --> O

  HX --> N
  Z --> Q

  style Z fill:#fde7d3,stroke:#c8551c
  style HX fill:#ffe9e9,stroke:#c0392b
  style Q fill:#dff5dd,stroke:#2e7d32
  style N fill:#e3f0ff,stroke:#1565c0
```

---

## Slide 3 — Three phases, plain English

### Phase 1 · Initiation & Triage
Customer scans/clicks → bot greets → 4 quick replies appear:
1. **View Menu / Order Pickup**
2. **Dine-in (table)**  *(launches in Phase 1.5)*
3. **Check Order Status**
4. **Ask a Question**

### Phase 2 · Core Processing
- **Question** → bot pulls from Shelby's approved knowledge base only.
- **Order** → menu → item → modifiers → cart → name+phone → order confirmed with **honest ETA**.
- **Status** → bot finds the customer's active order by phone number and shows live state.

### Phase 3 · Fulfillment & Handoff
- Order pops on the **barista tablet** (Kanban: New → Accepted → Preparing → Ready).
- Staff move the card; customer gets WhatsApp pings.
- **Customer steps up to the window only when "Ready"** — no crowding, no guessing.

---

## Slide 4 — The two lanes (this is the most important picture for the owner)

```mermaid
flowchart LR
  subgraph DIGITAL["DIGITAL LANE (new)"]
    direction TB
    DA[QR scan] --> DB[WhatsApp chat]
    DB --> DC[Order placed]
    DC --> DD[Wait at peace]
    DD --> DE[Ping: Ready]
  end

  subgraph PHYSICAL["PHYSICAL LANE (unchanged)"]
    direction TB
    PA[Walk up] --> PB[Verbal order]
    PB --> PC[Pay cash/UPI]
    PC --> PD[Wait at window]
  end

  DE --> WIN([Pickup Window])
  PD --> WIN

  style DIGITAL fill:#e8f4ff,stroke:#1565c0
  style PHYSICAL fill:#fff4e6,stroke:#c8551c
  style WIN fill:#dff5dd,stroke:#2e7d32
```

> **Both lanes converge at the window.** The digital lane *thins* the physical one — it never replaces it. Cash, no-WhatsApp, and "I just want to talk to a human" all keep working.

---

## Slide 5 — What changes for each role on Day 1 of pilot

| Role | Before | After |
|---|---|---|
| **Customer** | Stand in line, ask questions, guess wait time | Optional: scan QR, see ETA, get pinged |
| **Order-taker** | Verbal at window, repeats menu 100×/day | Verbal *only* for walk-ins; FAQ deflected to bot |
| **Baristas / shot puller / bun station** | Hear orders shouted | See orders on tablet, batch tea/coffee naturally |
| **Owner** | Guesses where the bottleneck is | Sees data: counter time, ETA delta, channel split |

---

## Slide 6 — Success in one image

```mermaid
flowchart LR
  X[Today: 1 line, 1 bottleneck<br/>20-min surprise wait] --> Y[After: 2 lanes, no surprise<br/>−25% counter time<br/>≥20% orders via WhatsApp<br/>≥70% FAQs auto-resolved]
  style X fill:#ffe9e9,stroke:#c0392b
  style Y fill:#dff5dd,stroke:#2e7d32
```

---

## Architect's Review — L0 (before going deeper)

**What is good at this level:**
- The two-lane model is honest about what we are *not* changing. This is what makes the owner trust the design.
- Single fulfillment point (the window) means there's no second physical surface to manage.
- The four customer intents map cleanly to four sub-systems (FAQ, Order, Dine-in, Status) — each can be built and tested independently.

**What we deliberately defer to L1:**
- *How* the bot decides confidence on FAQ answers
- *How* the cart is built and re-validated
- *How* the dashboard shows aggregate batching demand to staff
- *How* the Order ID matches the counter's existing naming convention

**Two decisions made at L0 that lock the rest of the build:**
1. **Order-level fulfillment** (not item-level) — preserves the 90% First-Come-First-Serve promise. Every L1/L2 design respects this.
2. **Pilot launches with Pickup + FAQ + Pay-at-counter only.** Dine-in, Razorpay, and broadcasts are gated behind pilot success. This shrinks the blast radius of any teething issue.

→ Now drilling into L1: each box in the macro flow gets its own deck.
