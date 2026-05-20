# SEED — Shelby the Barista WhatsApp Ordering System

> **Purpose of this document:** Single source of truth for vision, context, knowledge base, success criteria, and required outputs. All other deliverables (PRD, decks) descend from this seed.

---

## 1. Vision (one-paragraph north star)

Shelby is a high-velocity, ₹35-coffee, sidewalk "hole-in-the-wall" café in HSR Layout, Bengaluru that has gone viral on Instagram and now serves 500+ cups/day. Its biggest threat is its biggest asset: the crowd. We will build a **WhatsApp-native, phygital ordering layer** that runs *parallel* to the physical counter, decongests it during peak hours, sets honest wait-time expectations, and turns "ordered chaos" into a calm, brand-positive experience — without forcing Shelby's owner or staff to learn a new POS, app, or workflow.

> **Tagline for the owner:** *"Same window. Same vibe. Just one less line."*

---

## 2. Who is "Shelby"?

| Aspect | Detail |
|---|---|
| Type | Micro-retail specialty kiosk café |
| Location | Sector 2, HSR Layout, Bengaluru |
| Footprint | "Hole-in-the-wall" window service, no seating |
| Throughput | 500+ cups/day, 4–5 staff assembly line |
| Price band | ₹25 – ₹180 (premium-mass / "Tier 3 — Shelby Zone") |
| Brand persona | Peaky-Blinders-inspired, "Main Character Energy", warm staff rapport |
| Customer base | Gen Z / millennial tech workers, late-night "Geidi" cruisers, Instagram-driven FOMO crowd |
| Owner profile | Business operator (non-technical) — needs architect-level UX clarity in plain language |

---

## 3. The Problems We Are Solving (exhaustive)

Drawn from the research dossier and the phygital architecture KB:

1. **Peak-hour counter congestion & labor inefficiency** — manual order taking is a bottleneck on weekends; staff are pulled away from prep.
2. **"The Great Disappointment"** — viral FOMO drives crowds, but unannounced 20-minute waits damage the brand reputation.
3. **Repetitive customer inquiries** — "Do you have vegan milk?", "Are you open?", "Where exactly are you?" — flood staff and slow fulfillment.
4. **Friction in order capture & tracking** — verbal orders get misheard, lost, or duplicated; no audit trail.
5. **Menu drift / real-time availability** — Korean Buns, Hazelnut syrup, Elder Flower etc. sell out fast and there is no way to communicate this.
6. **Weather sensitivity** — Bengaluru rain kills sidewalk turnover with no fallback messaging.
7. **Crowd encroachment / regulatory risk** — sidewalk overflow attracts complaints; thinning the physical line directly mitigates this.
8. **No data on bottlenecks** — owner cannot tell whether the counter, kitchen, or queue is the actual constraint.

---

## 4. Solution Thesis (in one sentence)

A **WhatsApp Cloud API**-based ordering bot + **real-time staff dashboard** + **deterministic order engine** that captures structured orders, answers FAQs, sets honest ETAs, and pushes status updates back to customers — with **graceful physical fallbacks** so cash, no-WhatsApp, and internet-down scenarios never halt the café.

---

## 5. Guiding Architectural Principles (non-negotiable)

| # | Principle | Why it matters for Shelby |
|---|---|---|
| 1 | **Phygital parallelism** — digital lane never replaces the counter, only relieves it | Walk-ins, cash-only, no-smartphone customers must still be served the traditional way |
| 2 | **Determinism for money** — no AI in pricing, cart total, or inventory checks | A hallucinated ₹35 → ₹350 price destroys trust |
| 3 | **AI only for retrieval** — FAQ answers come from an approved Shelby knowledge base, never from open internet | Prevents wrong answers about menu/timing/policy |
| 4 | **Event log first, side effects second** — every webhook is stored raw before processing | Lets us replay/audit any order dispute |
| 5 | **Adapter layer for vendors** — WhatsApp/payment/LLM providers behind interfaces | Lets Shelby switch from BSP → Meta direct, Razorpay → Cashfree, etc. without rewrites |
| 6 | **Graceful degradation** — internet down ⇒ counter still works; payment fails ⇒ pay at counter; AI confused ⇒ human handoff | Café operations never come to a halt because of a software glitch |
| 7 | **Order-level fulfillment, not item-level** | Preserves the 90% First-Come-First-Serve promise; customer steps up only when the *whole* order is ready |
| 8 | **Idempotency everywhere** — duplicate webhook / double-tap button never charges twice or creates ghost orders | Critical for trust under flaky mobile networks |

---

## 6. Success Metrics (from PRD, locked)

| Metric | Target |
|---|---|
| Reduction in average counter order-taking time during peak | **−25%** |
| Share of peak-hour orders initiated via WhatsApp | **≥20% within 4 weeks** |
| WhatsApp-originated order error rate | **<3%** |
| Median time-to-first-response for automated replies | **<10 seconds** |
| FAQ chats resolved without staff intervention | **≥70%** |

Owner-visible KPIs (added):
- Counter dwell time (time customer spends at window)
- ETA-promise vs. actual prep-time delta
- Orders per staff-hour during peak
- Repeat-customer rate via phone-number identity

---

## 7. Knowledge Base — Compiled Sources

### 7.1 Menu Catalog (transcribed from boards, May 2026)

See `02_menu_catalog.md` for the structured, machine-readable version. Summary categories:

- **Milk Tea** (₹30–40) — Rose, Ginger, Mint, Masala, Vanilla
- **Black Tea** (₹25–35) — Mint Black, Lemon Honey, Clove Special
- **Milk Coffee** (₹50–70) — Shelby Signature, Chocolate, Vanilla, Caramel, Hazelnut
- **Black Coffee** (₹25) — Black, Jaggery Blast, Cinnamon-yana
- **Special** (₹35–150) — Horlicks, Boost, Badam Milk, Hot Chocolate, Boost on Rocks, Horlicks on Rocks, Premium Cold Coffee
- **Iced Tea** (₹80–95) — Lemon, Peach, Passion Fruit, Elder Flower
- **Cold Coffee** (₹150–180) — Premium, Hazelnut, Vanilla, Caramel, Irish
- **Mojito** (₹90 flat) — Watermelon, Passion Fruit, Strawberry, Orange, Mango, Virgin, Kala Khatta
- **Soda** — Lime Soda ₹50
- **Smoothy** — Mango Pulpy ₹120
- **Bakery** (per research) — Korean Cream Cheese Buns (Mushroom / Classic) — fast-mover, hot SKU
- **Must-try (signposted on board):** Coffees, Special Hot Chocolate, Lemon Honey

### 7.2 Operational facts (from research dossier)
- 4–5 staff assembly line: orders / milk / shots / buns
- 500+ cups/day; "Sidewalk Turnover" is the throughput metric, not table turnover
- Late-night driving culture ("Geidi") — relevant for evening/night load patterns
- Existing physical FCFS policy honored ~90% of the time

### 7.3 Risks (from sources, locked into KB)
| Risk | Mitigation embedded in design |
|---|---|
| Kitchen, not counter, may be the real bottleneck | Measure counter time and kitchen time separately during pilot |
| AI gives wrong answer | Retrieval-only, low-confidence ⇒ human handoff |
| Menu drift | One-click availability toggle on dashboard, single source of truth |
| Provider lock-in | Adapter interfaces |
| Payment confusion | Launch with pay-at-counter; payment link optional |
| Fake/no-show large orders | Cart cap (₹200) for unpaid; above ⇒ digital pay required |
| Bengaluru rain | "Weather Protocol" message in FAQ KB |
| Concurrent out-of-stock collision | Final webhook re-validates cart against live availability before confirm |
| Lost / dormant chat | 30-min session timeout, graceful restart |
| Encroachment / public-nuisance complaints | WhatsApp lane physically thins the sidewalk crowd |

---

## 8. Stack Recommendation (with rationale, owner-readable)

| Layer | Choice | Why this and not the others |
|---|---|---|
| WhatsApp channel | **Meta WhatsApp Cloud API via a BSP (Interakt or AiSensy)** for pilot, with adapter to go direct later | Official, ToS-safe, template approval handled by BSP; unofficial libs (whatsapp-web.js) risk number bans which would kill the brand |
| Backend | Node.js + Fastify | Light, fast, easy to host cheaply during pilot |
| Database | Supabase Postgres | Includes auth + Realtime out of the box → less infra to manage |
| Realtime to dashboard | Supabase Realtime | Sub-2s order push to barista tablet; no extra server |
| Jobs / retries | BullMQ + Redis (or Upstash QStash) | Idempotent webhook processing |
| Dashboard UI | Next.js + React | Fast to build, runs on any tablet browser |
| AI / FAQ | Hosted LLM + retrieval over approved Shelby docs | No internet-wide hallucination |
| Payments | Razorpay Payment Links (optional from week 3) | UPI-native, no PCI scope |
| Hosting | Vercel (UI) + Render/Railway/Fly (API) | Free/low tiers viable for pilot |

> **Owner takeaway:** every piece is replaceable, every piece is cheap to start, and nothing locks you in.

---

## 9. Required Outputs (this engagement)

1. ✅ `01_seed.md` — this document
2. ✅ `02_menu_catalog.md` — structured menu derived from boards
3. ✅ `03_prd_v2.md` — synthesized product spec (extends source PRD with phygital edge cases)
4. ✅ `04_deck_L0_macro.md` — end-to-end UX flow diagram (10,000 ft)
5. ✅ `05_deck_L1_components.md` — each L0 node decomposed
6. ✅ `06_deck_L2_micro.md` — micro-level: states, edge cases, failure modes, safety nets
7. ✅ `07_owner_presentation.md` — non-technical narrative deck for the owner

Each level reviewed before descending to the next, per the bubble-down architecture method.

---

## 10. Out of Scope (locked)

- Delivery / logistics
- Loyalty programs
- Marketing campaigns / broadcasts
- Full POS integration (kept as Phase 2)
- Voice ordering
- Multilingual AI beyond a curated FAQ set
