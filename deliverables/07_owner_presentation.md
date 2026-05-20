# Owner Presentation — Shelby × WhatsApp Phygital Ordering
*A non-technical narrative deck. Built to give the owner the same architectural clarity as the product architect, in plain language. Read top-to-bottom; each section is one "slide".*

---

## Slide 1 — The single sentence

> **We're going to add a WhatsApp lane next to your window. Same Shelby, same vibe, just one less line on Saturday night.**

---

## Slide 2 — What is the actual problem we're solving?

You've already won the brand fight. The risks now are operational:

1. The crowd that made you famous is the crowd that's slowing you down.
2. People wait 20 minutes for a ₹35 coffee — and some of them are starting to write about that wait online.
3. Your staff hear the same five questions all day. ("Are you open?" "Vegan milk?" "Do you have buns today?")
4. When Hazelnut runs out, the next 4 customers don't know it until they reach the window.
5. When it rains, the sidewalk empties and you have no way to tell people *"we're still open."*

We are not redesigning your café. We are removing one specific bottleneck: **the verbal order taken at the counter during peak hours.**

---

## Slide 3 — The core idea, in one picture

```
            ┌────────────────────────┐
   Sidewalk │          QR            │ ◄── Customer scans
            └─────────────┬──────────┘
                          ▼
                  WhatsApp opens.
                  Bot greets them.
                  They tap "Order".
                          ▼
              They pick items, see ETA,
              get an order code.
                          ▼
         ┌──── Tablet inside the kiosk ────┐
         │   New ▸ Accepted ▸ Preparing ▸  │
         │   Ready                          │
         └─────────────┬───────────────────┘
                          ▼
              "Your order is ready" 📲
                          ▼
              Customer steps up to window.
```

That's the whole product. Everything else is making sure this loop survives the messy reality of a real café.

---

## Slide 4 — The most important promise we're making to you

> **Your physical café does not change.**

- Cash-only customers? **Walk up to the window like always.**
- No WhatsApp? **Walk up to the window like always.**
- Internet drops? **Walk up to the window like always.**
- Someone just wants to chat with the barista? **Walk up to the window like always.**

The WhatsApp lane is *additive*. We are giving you a way to thin the crowd, not replace it.

---

## Slide 5 — Three levels of the design (bubble-down)

We've designed this in three depths so you can verify it the same way an architect verifies a building.

| Level | What it shows | Where it lives |
|---|---|---|
| **L0 — Macro** | The whole journey in one diagram | `04_deck_L0_macro.md` |
| **L1 — Components** | Each big box opened up: FAQ, Order, Status, Dashboard, Triage | `05_deck_L1_components.md` |
| **L2 — Micro** | Every "what if it goes wrong?" with a specific behavior | `06_deck_L2_micro.md` |

You don't need to remember the diagrams. You need to remember the **promises** they encode. The next slides are those promises.

---

## Slide 6 — Promise #1: Honest wait times

When the kitchen is slammed, the bot says so.

- Less than 5 orders in prep → "Ready in ~8 minutes."
- 5–15 orders → "Ready in ~10–12 minutes."
- More than 15 → "Rush hour, ready in 18–22 minutes."

The customer agrees to that wait *before* they order. **The Great Disappointment never happens** because we never promised 8 minutes when it was actually 25.

---

## Slide 7 — Promise #2: Whole-order delivery

A customer ordering 1 coffee + 1 Korean Bun gets ONE notification, when **both** are ready. They walk to the window once.

This protects your 90% First-Come-First-Serve floor — earlier orders that are fully assembled get handed over before later half-built ones. No crowding. No "where's my bun?" at the window.

---

## Slide 8 — Promise #3: Five kill switches you control

You don't need to call an engineer for any of these. Every one is a button on the dashboard:

| Switch | When you'd use it |
|---|---|
| **Item availability toggle** | Hazelnut syrup is out → one tap, gone from WhatsApp menu |
| **Rain mode** | Bengaluru is dumping water → bot tells everyone "we're still open" |
| **ETA factor** | You feel the rush is heavier than usual → push ETAs longer |
| **Pause digital lane** | Kitchen is in chaos → bot tells customers "walk to the window" |
| **Manual handoff** | Customer chat got weird → take over the chat yourself |

---

## Slide 9 — Promise #4: The system can break and your café won't

| If this breaks... | This still works |
|---|---|
| Internet | Walk-in counter (verbal) |
| WhatsApp provider | Walk-in counter, plus AI-free FAQ on the bot side eventually |
| Razorpay payments | "Pay at counter" is the default anyway |
| Our AI / FAQ engine | Bot falls back to human handoff |
| The dashboard | Staff verbal at counter; orders queue up and replay when it returns |
| A duplicate webhook (double tap) | We make ONE order, never two |

> **Coffee never stops being made.**

---

## Slide 10 — Promise #5: No AI in your money

- AI is used for **one thing only**: answering FAQs from your approved knowledge base.
- Every price is calculated by a deterministic database query. Always.
- Every total is calculated by a deterministic database query. Always.
- Every availability check happens **twice** — when you add to cart, and again at the moment you confirm.
- The system will never invent a ₹350 Hazelnut Cold Coffee.

---

## Slide 11 — Day 1 of the pilot: what literally changes

| Before pilot | During pilot (week 4) |
|---|---|
| Stick a menu board on the window | Add a small QR sticker that says *"Skip the line — order on WhatsApp"* |
| Verbal orders at counter | Verbal orders at counter **plus** WhatsApp orders dropping into a tablet |
| Staff repeats the menu 100×/day | Bot answers most repeat questions; staff sees handoff column for tricky ones |
| You guess where the bottleneck is | Dashboard shows: counter time, ETA delta, channel split, FAQ deflection |
| Item runs out and 4 more orders for it slip in | One tap: gone from WhatsApp menu instantly |

Cash, walk-ins, regulars who insist on chatting with the barista — *all unchanged.*

---

## Slide 12 — The 4-week timeline (what you'll see and when)

| Week | What happens behind the scenes | What you see |
|---|---|---|
| 1 | We build the foundation, schema, and a basic dashboard | Nothing on the floor yet |
| 2 | Order engine + Kanban dashboard live | We test internally with fake orders |
| 3 | FAQ engine, payments (optional), templates approved | We do a "shadow pilot" — staff watches the dashboard during real off-peak hours |
| 4 | Pilot for real, weekend peak window | QR sticker goes up. We sit beside you and watch. |

---

## Slide 13 — What we measure to declare success

The metrics that decide if this works:

| Metric | Target | Why it matters to you |
|---|---|---|
| Counter dwell time | **−25%** | Less crowding, fewer encroachment complaints |
| % of peak orders via WhatsApp | **≥20%** | Real channel adoption, not a toy |
| Order error rate via WhatsApp | **<3%** | Trust |
| Median bot response | **<10s** | Customers feel attended to |
| % of FAQs auto-resolved | **≥70%** | Staff freed for prep |
| ETA promised vs actual delta | **≤ ±20%** | Brand reputation protected |

If any of these miss after 2 weeks of pilot, **we adjust before scaling**, not after.

---

## Slide 14 — What it costs (rough, pilot)

| Item | Pilot cost (monthly) |
|---|---|
| WhatsApp BSP (Interakt / AiSensy) | ~₹1,000–₹2,500 |
| WhatsApp conversation fees (Meta) | ~₹500–₹1,500 at pilot volumes |
| Supabase (DB + realtime) | Free tier likely covers pilot |
| Hosting (Vercel + Render free/hobby) | Free / minimal |
| LLM (FAQ retrieval) | ~₹500–₹1,000 |
| Razorpay | 2% only on transactions, optional |
| **Approx total** | **~₹2,000–₹5,000/month during pilot** |

(Excludes development time. Stack scales linearly with order volume — so unit economics improve as Shelby grows, not worsen.)

---

## Slide 15 — Risks we are explicitly carrying (no surprises)

| Risk | Plan |
|---|---|
| Kitchen, not counter, may be the actual bottleneck | We measure both separately during the pilot. Channel-shift relieves counter regardless. |
| Customers may not adopt WhatsApp ordering | We aim for **20% only** in week 4 — small, achievable, then grow |
| Staff resistance | The dashboard mirrors your existing assembly-line; we train one designated person first |
| Provider lock-in (BSP/payment) | Adapter layer lets us swap providers in days, not weeks |
| Edge cases we haven't thought of | The system **logs everything raw** — every issue is reproducible and fixable |

---

## Slide 16 — What we explicitly are NOT doing (yet)

- Delivery (Swiggy/Zomato style) — not for MVP
- Loyalty programs / coupons — not for MVP
- Marketing broadcasts to past customers — Phase 2 (needs opt-in)
- Full POS replacement — never; this complements, doesn't replace
- Voice ordering — never (defeats the calm of WhatsApp)
- Multi-language AI — Phase 2

This is deliberate. **Smaller MVP = clearer pilot = faster learning = less wasted money.**

---

## Slide 17 — The one question you should ask me at the end of this slide

> *"What's the smallest thing we can do in week 4 to prove this works?"*

**Answer:** stick the QR up at 6pm Saturday. Watch the tablet. If even 30 of the 500 cups that night come through WhatsApp, with <3% errors and an honest ETA, we have a working channel. We then scale it across weekday peaks, then evenings, then dine-in tables, then payments.

---

## Slide 18 — The deeper bet

This system is also a **data engine**. Six months in, you will know:

- Exactly which items run out fastest, and when
- Which times of day are your real bottlenecks
- Which customers come back (anonymous, by phone)
- Which questions to put on a permanent sign vs. answer in chat
- Whether the Korean Bun is worth keeping (or pivoting to the next trend item)

You can't get any of this from a verbal counter today.

---

## Slide 19 — Decision summary for the owner

| Decision | Default answer | Owner override |
|---|---|---|
| Build with WhatsApp Cloud API via BSP? | **Yes** (Interakt or AiSensy) | — |
| Pilot launches with Pickup + FAQ only? | **Yes** | Yes/No |
| Razorpay in pilot? | **No** (Phase 3) | Yes/No |
| Dine-in tables in pilot? | **No** (Phase 1.5) | Yes/No |
| Cart cap for unpaid orders? | **₹200** | Tune |
| Rush ETA threshold? | **>15 in PREPARING** | Tune |
| Korean Buns on the bot menu from day 1? | **Yes if available** | Confirm price |

If you nod on these defaults, week 1 begins.

---

## Appendix — Where to look for what

| If you want to see... | Open this file |
|---|---|
| The vision and full knowledge base | `01_seed.md` |
| The structured menu the system will use | `02_menu_catalog.md` |
| The full product spec (engineering-grade) | `03_prd_v2.md` |
| The customer journey at a glance | `04_deck_L0_macro.md` |
| Each component opened up | `05_deck_L1_components.md` |
| Every "what if" answered | `06_deck_L2_micro.md` |
| The non-technical narrative (this file) | `07_owner_presentation.md` |
