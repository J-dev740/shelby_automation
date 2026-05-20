# Phase 1 — Order Fulfillment Sub-Pipeline (Flow 2 only)

> **Purpose:** ship a battle-tested, production-ready WhatsApp ordering system that solves Shelby's peak-hour counter congestion **fast and with minimal error margin**. Everything outside Flow 2 (FAQ, status lookup, handoff, NL ordering) is explicitly deferred.
>
> **Parent PRD:** `03_prd_v2.md`. This document is the *surgical execution plan*.
>
> **Non-goal:** elegance, completeness, multi-tenant. **Goal:** one café, one number, zero dropped orders.

---

## 1. Phase 1 scope — what ships, what doesn't

### IN (Phase 1)
- **Flow 2: Order** — pickup orders end-to-end, structured (buttons/lists only).
- **Intent classifier** as the front door, but with only **two routes live**: `Order` and `Handoff`. FAQ and Status return a templated *"coming soon — please walk up to the window or tap **Talk to staff**"* message.
- **Customer notes** (per-item ≤80 chars, per-order ≤140 chars).
- **Staff dashboard** — Kanban with note-aware cards, availability toggles, kill switch.
- **Pay at counter** as the only payment mode.
- **Idempotency, retries, DLQ, audit log, monitoring**.

### OUT (Phase 1, ship later)
- FAQ retrieval engine
- Order status self-serve lookup (staff handles via handoff for now)
- Razorpay
- Dine-in / table flow
- Natural-language ordering
- Multi-language
- Loyalty / broadcasts

### Why this slicing works
Counter congestion is solved if **30% of peak-hour cups arrive pre-ordered with a correct ETA**. That's the success criterion. FAQ and status are nice-to-haves; they don't move the bottleneck needle in week 4.

---

## 2. Architecture — the production blueprint

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER PHONE (WhatsApp)                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │ HTTPS POST
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │  EDGE: Meta Cloud API (or BSP)                      │
        │  - delivers webhooks                                │
        │  - rate-limits sending                              │
        └─────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ╔═════════════════════════════════════════════════════╗
        ║  WEBHOOK GATEWAY  (Fastify, stateless, scale-out)   ║
        ║  Responsibilities (≤500ms, return 200):             ║
        ║   1. Verify HMAC signature                          ║
        ║   2. Dedupe by provider message_id (Redis SETNX)    ║
        ║   3. Persist raw payload → Postgres `messages_raw`  ║
        ║   4. Enqueue normalized job → BullMQ                ║
        ║   5. Return 200 OK                                  ║
        ╚═════════════════════════════════════════════════════╝
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │  BullMQ Queue:  inbound-messages                    │
        │  - Redis (Upstash in prod, local Redis in dev)      │
        │  - retries: 5 with expo backoff                     │
        │  - DLQ: dead-inbound after retry exhaustion         │
        └─────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ╔═════════════════════════════════════════════════════╗
        ║  ORCHESTRATOR WORKER  (long-running container)      ║
        ║  ┌────────────────────────────────────────────────┐ ║
        ║  │ a) Intent Classifier                           │ ║
        ║  │    button_id → keyword → state-hint → LLM      │ ║
        ║  └────────────────────────────────────────────────┘ ║
        ║  ┌────────────────────────────────────────────────┐ ║
        ║  │ b) Session FSM (XState)                        │ ║
        ║  │    loads session row → transition → persists   │ ║
        ║  └────────────────────────────────────────────────┘ ║
        ║  ┌────────────────────────────────────────────────┐ ║
        ║  │ c) Service calls (deterministic):              │ ║
        ║  │    MenuService · CartService · OrderService    │ ║
        ║  └────────────────────────────────────────────────┘ ║
        ║  ┌────────────────────────────────────────────────┐ ║
        ║  │ d) Outbound: enqueue send-message job          │ ║
        ║  └────────────────────────────────────────────────┘ ║
        ╚═════════════════════════════════════════════════════╝
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │  BullMQ Queue:  outbound-messages                   │
        │  - rate-limited to BSP quota                        │
        │  - retries: 3 with backoff                          │
        └─────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │  Sender Worker → MessagingProvider.sendMessage()    │
        └─────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────────────────────┐
        │  Postgres (Supabase) — single source of truth       │
        │  - orders / order_items (with customer_note)        │
        │  - sessions (FSM state, cart_json)                  │
        │  - menu_* (active flag = source of truth)           │
        │  - messages_raw / messages (audit log)              │
        │  - idempotency_keys (msg_id, op_id)                 │
        │  - system_settings (kill switches)                  │
        └─────────────────────────────────────────────────────┘
                       │                              ▲
                       │ Realtime (LISTEN/NOTIFY)     │ HTTP/RPC
                       ▼                              │
        ┌─────────────────────────────────────────────────────┐
        │  STAFF DASHBOARD  (Next.js on Vercel)               │
        │  - Kanban: New / Accepted / Preparing / Ready       │
        │  - note-aware order cards                           │
        │  - availability toggles                             │
        │  - kill switch (digital_lane_paused)                │
        └─────────────────────────────────────────────────────┘
```

### Why three queues vs. one synchronous handler
1. **Webhook timeout safety** — Meta retries if you don't ACK in seconds. Synchronous DB writes during a peak rush would melt this.
2. **Send-side rate limiting** — outbound has its own queue with token-bucket limiter to respect BSP quotas.
3. **Failure isolation** — a flaky send doesn't block ingestion; a slow DB doesn't drop a webhook.

---

## 3. Repository layout

```
shelby-whatsapp/
├── apps/
│   ├── api/                    ← Fastify backend (gateway + workers)
│   │   ├── src/
│   │   │   ├── server.ts       ← Fastify app + routes
│   │   │   ├── routes/
│   │   │   │   ├── webhook.meta.ts
│   │   │   │   ├── webhook.razorpay.ts   (stub, Phase 3)
│   │   │   │   └── health.ts
│   │   │   ├── workers/
│   │   │   │   ├── inbound.worker.ts    ← BullMQ consumer
│   │   │   │   └── outbound.worker.ts   ← BullMQ consumer (sender)
│   │   │   ├── orchestrator/
│   │   │   │   ├── classifier.ts        ← intent classifier (4 layers)
│   │   │   │   ├── fsm.ts               ← XState session machine
│   │   │   │   └── handlers/
│   │   │   │       ├── order.handler.ts
│   │   │   │       └── handoff.handler.ts
│   │   │   ├── services/
│   │   │   │   ├── menu.service.ts
│   │   │   │   ├── cart.service.ts      ← deterministic pricing
│   │   │   │   ├── order.service.ts
│   │   │   │   ├── notes.sanitizer.ts   ← profanity/url/length
│   │   │   │   └── eta.service.ts       ← rush detection
│   │   │   ├── adapters/
│   │   │   │   ├── messaging/
│   │   │   │   │   ├── provider.interface.ts
│   │   │   │   │   ├── meta-cloud.provider.ts
│   │   │   │   │   └── mock.provider.ts        ← for tests
│   │   │   │   └── llm/
│   │   │   │       ├── provider.interface.ts
│   │   │   │       ├── gemini.provider.ts
│   │   │   │       └── mock.provider.ts
│   │   │   ├── lib/
│   │   │   │   ├── idempotency.ts       ← Redis SETNX wrapper
│   │   │   │   ├── queue.ts             ← BullMQ factory
│   │   │   │   ├── db.ts                ← Postgres pool
│   │   │   │   └── log.ts               ← Pino
│   │   │   └── config/env.ts            ← zod-validated env vars
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   │       └── webhook-payloads/    ← captured ngrok replays
│   │   └── package.json
│   │
│   └── dashboard/              ← Next.js 14 (App Router)
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── (app)/
│       │   │   ├── kanban/page.tsx
│       │   │   ├── orders/[id]/page.tsx
│       │   │   ├── menu/page.tsx        ← availability toggles
│       │   │   └── settings/page.tsx    ← kill switches
│       │   └── api/                     ← server actions
│       ├── components/
│       │   ├── OrderCard.tsx            ← note-aware
│       │   ├── KanbanColumn.tsx
│       │   └── ItemNoteChip.tsx
│       ├── lib/supabase.ts              ← realtime subscription
│       └── package.json
│
├── packages/
│   └── shared/                 ← types, zod schemas, constants
│       ├── src/
│       │   ├── types/order.ts
│       │   ├── types/session.ts
│       │   ├── schemas/cart.zod.ts
│       │   └── constants/states.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_notes.sql
│   │   └── 0003_idempotency.sql
│   └── seed.sql                 ← menu seed from 02_menu_catalog.md
│
├── tools/
│   ├── replay.ts                ← bulk-replay captured payloads
│   └── seed-menu.ts
│
├── .env.example
├── docker-compose.dev.yml       ← Postgres + Redis for local
├── turbo.json                   ← monorepo build orchestration
└── package.json                 ← pnpm workspaces
```

**Why monorepo:** types are shared between Fastify backend and Next.js dashboard. A change to the Order schema breaks both at compile time, not at runtime.

---

## 4. Database schema (Phase 1 DDL)

```sql
-- 0001_init.sql (Phase 1 essentials)

create table customers (
  id              uuid primary key default gen_random_uuid(),
  phone_e164      text unique not null,
  display_name    text,
  created_at      timestamptz not null default now()
);

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id),
  state           text not null default 'idle',
  cart_json       jsonb not null default '[]'::jsonb,
  context_json    jsonb not null default '{}'::jsonb,  -- selected category, item, modifiers in flight
  last_activity_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index sessions_customer_idx on sessions(customer_id);
create index sessions_state_idx on sessions(state);

create table menu_categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  sort_order      int not null default 0,
  active          boolean not null default true
);

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references menu_categories(id),
  slug            text unique not null,
  name            text not null,
  price_inr       int not null,                        -- store paise? no, INR is whole rupees here
  prep_time_min   int not null default 5,
  active          boolean not null default true,       -- single source of truth
  sort_order      int not null default 0
);
create index menu_items_active_idx on menu_items(active);

create table modifier_groups (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references menu_items(id) on delete cascade,
  name            text not null,
  min_select      int not null default 0,
  max_select      int not null default 1
);

create table modifiers (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references modifier_groups(id) on delete cascade,
  name            text not null,
  price_delta_inr int not null default 0,
  active          boolean not null default true
);

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text unique not null,                -- e.g., SHL-A4F2
  customer_id         uuid not null references customers(id),
  source              text not null default 'whatsapp',
  state               text not null default 'new',         -- new|accepted|preparing|ready|completed|cancelled
  subtotal_inr        int not null,
  total_inr           int not null,
  payment_mode        text not null default 'counter',     -- counter|razorpay (Phase 3)
  payment_status      text not null default 'pending',
  customer_note       text,                                -- ≤140 chars
  dynamic_eta_factor  numeric(3,2) not null default 1.00,
  promised_eta_min    int not null,
  intent_route        text not null default 'order',
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_state_created_idx on orders(state, created_at);
create index orders_customer_idx on orders(customer_id);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  item_id         uuid not null references menu_items(id),
  qty             int not null check (qty > 0),
  unit_price_inr  int not null,                        -- snapshot at order time
  line_total_inr  int not null,                        -- snapshot
  customer_note   text,                                -- ≤80 chars
  position        int not null
);

create table order_item_modifiers (
  id              uuid primary key default gen_random_uuid(),
  order_item_id   uuid not null references order_items(id) on delete cascade,
  modifier_id     uuid not null references modifiers(id),
  modifier_name   text not null,                       -- snapshot
  price_delta_inr int not null                         -- snapshot
);

create table order_status_events (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  from_state      text,
  to_state        text not null,
  changed_by      text,                                -- staff_id or 'system'
  reason          text,
  created_at      timestamptz not null default now()
);
create index order_status_events_order_idx on order_status_events(order_id, created_at);

create table messages_raw (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,                       -- meta|interakt|aisensy
  payload_json    jsonb not null,
  received_at     timestamptz not null default now()
);

create table messages (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid references customers(id),
  direction             text not null,                 -- inbound|outbound
  provider_msg_id       text unique,                   -- dedupe key
  body                  text,
  payload_json          jsonb,
  classified_intent     text,                          -- order|handoff|faq|status|unknown
  classifier_confidence numeric(3,2),
  created_at            timestamptz not null default now()
);

create table idempotency_keys (
  key             text primary key,
  scope           text not null,                       -- 'webhook' | 'order_create' | 'state_transition'
  result_json     jsonb,
  created_at      timestamptz not null default now()
);

create table staff_users (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  role            text not null,                       -- staff|admin
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table system_settings (
  key             text primary key,
  value_json      jsonb not null,
  updated_by      uuid references staff_users(id),
  updated_at      timestamptz not null default now()
);

-- Seeded keys:
--   digital_lane_paused: false
--   rush_threshold: 15
--   eta_inflation_factor: 1.5
--   rain_protocol_active: false
```

**Indexes prioritized for the hot paths:**
- `orders(state, created_at)` — Kanban query.
- `messages(provider_msg_id)` — webhook dedupe.
- `sessions(customer_id)` — every inbound message hits this.

---

## 5. Session FSM (Phase 1 — order flow only)

```
                                    [idle]
                                       │
                                       ▼  (any inbound)
                                  [classifying]
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                  [order route]  [handoff route]  [unknown]
                          │            │            │
                          ▼            ▼            ▼
                 [ordering_select_type]  [handoff_requested]   (re-prompt menu)
                          │
                          ▼
                 [ordering_select_category]
                          │
                          ▼
                 [ordering_select_item]
                          │
                          ▼
                 [ordering_select_modifiers]   ← one trip per modifier group
                          │
                          ▼
                 [ordering_item_note]          ← skippable
                          │
                          ▼
              ┌─────────[ordering_review_cart]───────┐
              │             │                        │
              │   "+ add"   │     "checkout"         │ "remove"
              │             ▼                        │
              │   (back to category)                 │
              └─────────────┼────────────────────────┘
                            ▼
                   [ordering_order_note]      ← skippable
                            │
                            ▼
                   [ordering_collect_identity]
                            │
                            ▼
                   [ordering_confirmed]       ← writes orders row, exits to idle
```

**Implementation:** XState machine in `apps/api/src/orchestrator/fsm.ts`. State + cart persisted to `sessions` table on every transition. Worker is **stateless** — it always reloads the session row before transitioning. This makes horizontal scaling trivial.

**Timeouts:**
- Session dormant >30 min → next inbound force-resets to `classifying`.
- `ordering_payment_pending` >5 min → auto-flip to `ordering_confirmed` with `payment_mode='counter'`.

---

## 6. Idempotency — the discipline

Three layers, each with its own key strategy:

| Layer | Key | Storage | TTL |
|---|---|---|---|
| Webhook ingestion | `wh:{provider_msg_id}` | Redis SETNX | 24h |
| Order creation | `order:{session_id}:{cart_hash}` | `idempotency_keys` table | 1h |
| Outbound send | `out:{order_id}:{event_type}` | Redis SETNX | 6h |

**Rules:**
1. Webhook handler does `SETNX wh:{msg_id} 1 EX 86400` — if key exists, return 200 immediately, do not enqueue.
2. Order creation hashes the canonical cart JSON (sorted keys); if the same `(session_id, hash)` already produced an order in last hour, return that existing order — covers double-tap on Confirm.
3. Outbound notifications are keyed by `(order_id, event)` — "ready" can only be sent once per order regardless of how many times staff taps the button.

---

## 7. Cart & pricing — deterministic, period

```ts
// apps/api/src/services/cart.service.ts (sketch)

type CartLine = {
  itemId: string;
  qty: number;
  modifierIds: string[];
  customerNote?: string;
};

async function priceCart(lines: CartLine[]): Promise<PricedCart> {
  // 1. Fetch all items + modifiers in ONE query, with active=true filter
  const items = await db.menuItems.findMany({
    where: { id: { in: lines.map(l => l.itemId) }, active: true }
  });

  // 2. Hard-fail any inactive item — caller must handle
  for (const line of lines) {
    if (!items.find(i => i.id === line.itemId)) {
      throw new ItemUnavailableError(line.itemId);
    }
  }

  // 3. Compute line totals server-side; never trust client
  // 4. Validate modifier groups (min/max select)
  // 5. Sanitize customer notes (trim, strip control, profanity, url)
  // 6. Return { lines, subtotal, total, etaMin }
}
```

**Invariants enforced by tests:**
- Cart total = Σ line totals = Σ (item.price + Σ modifier.delta) × qty.
- No item with `active=false` can survive `priceCart`.
- Notes never alter price.
- Cart ETA = `max(item.prep_time_min) × dynamic_eta_factor`.

---

## 8. ETA inflation logic

```ts
async function computeEtaFactor(): Promise<number> {
  const preparingCount = await db.orders.count({
    where: { state: { in: ['accepted', 'preparing'] } }
  });
  const threshold = await getSetting('rush_threshold');     // 15
  const inflation = await getSetting('eta_inflation_factor'); // 1.5
  return preparingCount > threshold ? inflation : 1.0;
}
```

Computed once per order at creation, **stamped onto `orders.dynamic_eta_factor`**, never recomputed. Customer sees the same ETA they agreed to.

---

## 9. Notes sanitizer

```ts
// apps/api/src/services/notes.sanitizer.ts

const MAX_ITEM = 80;
const MAX_ORDER = 140;
const PROFANITY = new Set([...]);  // small curated list, India-context
const URL_RE = /https?:\/\/\S+/gi;

export function sanitizeNote(input: string, kind: 'item' | 'order'): string {
  let s = (input ?? '').trim();
  s = s.replace(/[\x00-\x1f\x7f]/g, '');     // strip control chars
  s = s.replace(URL_RE, '');                  // no URLs
  const max = kind === 'item' ? MAX_ITEM : MAX_ORDER;
  if (s.length > max) s = s.slice(0, max);
  // tokenize, drop profanity tokens
  const tokens = s.split(/\s+/).filter(t => !PROFANITY.has(t.toLowerCase()));
  return tokens.join(' ').trim();
}
```

**Quick-note buttons** (one tap, no typing) — emitted by the bot as `quick_reply` payloads in `ordering_item_note`:
`Less sugar` · `No sugar` · `Extra hot` · `Less ice` · `With honey` · `Skip` · `Custom…`

---

## 10. Dashboard contract — the note-aware order card

```
┌─────────────────────────────────────────────────────────┐
│  SHL-A4F2          [📝]              7 min   ● NEW      │
│  Rindrajith · 9876543210                                │
│ ─────────────────────────────────────────────────────── │
│  ⚠ Order note: please pack with extra tissues          │  ← yellow banner
│ ─────────────────────────────────────────────────────── │
│  1× Hazelnut Cold Coffee     ₹180                       │
│      🟡 less sugar  · 🔵 extra hot                      │  ← inline chips
│  2× Masala Tea               ₹80                        │
│      (no notes)                                         │
│ ─────────────────────────────────────────────────────── │
│  Total ₹260 · pay-at-counter                            │
│  [ Accept ]   [ Cancel ]                                │
└─────────────────────────────────────────────────────────┘
```

**Realtime contract:** dashboard subscribes to Postgres changes on `orders` and `order_items` via Supabase Realtime. New orders animate into the **NEW** column within 2s P95.

**Kill switches** (admin-only, top of dashboard):
- `[⏸ Pause Digital Lane]` — flips `system_settings.digital_lane_paused`. Bot replies "we're a bit slammed, please walk up to the window."
- `[🌧 Rain Mode]` — flips `rain_protocol_active`. Bot prepends weather copy.
- ETA inflation slider — adjusts `eta_inflation_factor`.

---

## 11. Test strategy — what "battle-tested" means

### Unit (Vitest) — 90% coverage on:
- `cart.service.priceCart` — every modifier combination, every error path.
- `notes.sanitizer` — boundary lengths, control chars, urls, profanity.
- `eta.service.computeEtaFactor` — boundary at `rush_threshold`.
- `idempotency` — concurrent SETNX behavior.
- FSM transitions — every state × every event.

### Integration (supertest + ephemeral Postgres + ephemeral Redis):
- Webhook → ack-200 → enqueue → consume → DB write.
- Double-webhook with same `provider_msg_id` produces ONE order.
- Item flipped to `active=false` mid-cart → confirm rejects with friendly fallback.
- Cart cap >₹200 unpaid → blocks confirm.

### Replay regression harness:
- `tools/replay.ts` reads `apps/api/tests/fixtures/webhook-payloads/*.json` (captured from ngrok Traffic Inspector during dev) and replays them against a fresh local stack. Run on every PR.

### Load test (k6):
- 50 RPS sustained webhook ingestion for 5 min → P95 ack <500ms, zero drops, zero duplicate orders.

### Chaos drills before pilot:
- Kill Redis mid-session → orders queued on inbound persist via raw payload table; on reboot, re-enqueue.
- Kill DB mid-confirm → BullMQ retries; idempotency keys prevent duplicate orders on success.
- BSP send API returns 5xx → outbound retries 3× → DLQ → staff notified on dashboard banner.

---

## 12. Observability — what we watch in production

| Metric | Source | Alert at |
|---|---|---|
| Webhook ack P95 | Pino structured logs → Better Stack | >800ms for 5 min |
| Inbound queue depth | BullMQ metrics | >100 jobs |
| Inbound DLQ count | BullMQ metrics | >0 (paged) |
| Outbound send failures | Pino + provider response | >2% over 5 min |
| Order create error rate | DB constraint failures + app errors | >1% over 10 min |
| Realtime push lag | Heartbeat from dashboard | >3s P95 |
| Active sessions | DB query | informational |

**Logging discipline:**
- Every log has `traceId`, `customerId`, `sessionId`, `orderId` (where applicable).
- Raw payloads NEVER logged at INFO — only at DEBUG with PII redaction.
- Phone numbers redacted to `+91XXXXX2345` in non-DEBUG logs.

---

## 13. Local dev setup (frictionless DX)

```bash
# 1. Boot deps
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis

# 2. Run migrations + seed
pnpm --filter api supabase:reset
pnpm --filter api seed:menu

# 3. Start backend (Fastify + workers in same process for dev)
pnpm --filter api dev          # listens on :3000

# 4. Start dashboard
pnpm --filter dashboard dev    # :3001

# 5. Expose webhook to Meta
ngrok http 3000
# → copy https://abc123.ngrok-free.app/webhook/meta into Meta dashboard
```

**Replay-driven dev loop:**
1. Send a real WhatsApp message once (or use ngrok Traffic Inspector to capture).
2. Save the payload to `tests/fixtures/webhook-payloads/`.
3. Edit parser.
4. `pnpm replay <fixture>` — instant feedback, no phone needed.

---

## 14. Deployment

| Component | Where | Why |
|---|---|---|
| Fastify gateway + workers | **Render** (Standard plan, 1 instance to start) | Always-on; persistent BullMQ workers; cheap; auto-deploy on git push |
| Postgres | **Supabase Pro** (₹2k/mo at pilot scale) | Managed, with Realtime |
| Redis | **Upstash** (free tier covers pilot) | Serverless Redis, BullMQ-compatible |
| Next.js dashboard | **Vercel** | Free; native Next.js |
| DNS / SSL | Cloudflare (free) | TLS everywhere |
| Secrets | Render env vars + GitHub Actions secrets | Rotated quarterly |
| CI/CD | GitHub Actions | lint → typecheck → test → migrate → deploy |

**Deploy flow:**
```
git push origin main
  → CI runs: lint, typecheck, vitest, replay regression
  → on green: supabase migrations applied
  → on green: Render rebuilds API
  → on green: Vercel rebuilds dashboard
  → smoke test: synthetic webhook → expects 200 in <500ms
  → if smoke fails: auto-rollback + page on-call
```

---

## 15. Acceptance gates — when do we open the QR to the public?

The pilot QR sticker goes on the window **only after all of these pass**:

- [ ] Replay harness: 100% of captured fixtures process without error.
- [ ] Load test: 50 RPS for 5 min, P95 <500ms ack, zero duplicate orders.
- [ ] Chaos drill: Redis kill, DB kill, BSP 5xx — all recover without manual intervention.
- [ ] 24h staff shadow run: dashboard receives ≥10 fake orders, staff transitions all to Ready without confusion.
- [ ] Owner kill-switch verified: `pause digital lane` toggle works in <5s end-to-end.
- [ ] Note sanitizer: no profanity / URL gets through; boundary lengths enforced.
- [ ] Idempotency: double-tap Confirm produces exactly ONE order — verified by automated test AND manual barista test.
- [ ] Monitoring dashboards live; alert routing tested by deliberately tripping each alert.
- [ ] Incident runbook printed and posted on kiosk wall.
- [ ] Owner has signed off on §16 of `03_prd_v2.md` (canonical stack) and the cart cap (₹200).

---

## 16. Phase 1 timeline (4 weeks, surgical)

| Week | Engineering | Demo at end of week |
|---|---|---|
| **W1: Foundation** | Repo scaffold · Supabase migrations · webhook gateway with HMAC + dedupe · BullMQ wired · adapters scaffolded · ngrok dev loop · Pino + traceId · CI green | Send "hi" → 200 OK in <500ms → row in `messages_raw` |
| **W2: Order Engine** | Menu service · Cart service (deterministic) · FSM order flow · Notes sanitizer · Order creation with idempotency · Dashboard skeleton with Kanban + realtime | End-to-end: WhatsApp button-tap → order appears in dashboard NEW column |
| **W3: Hardening** | Availability re-check at confirm · ETA inflation · kill switches · note-aware order cards · sender worker with rate-limit · DLQ wiring · monitoring dashboards · replay regression in CI | Chaos drill demo: kill Redis → orders survive |
| **W4: Pilot** | 24h staff shadow · QR design + print · acceptance gate audit · weekend peak pilot · daily metrics review · bug triage | Pilot live; ≥30 real orders through WhatsApp at weekend peak |

---

## 17. Phase 2 / Phase 3 — what comes next (NOT in Phase 1)

| Phase | Adds | Trigger to start |
|---|---|---|
| **Phase 1.5** (week 5–6) | FAQ engine (retrieval over approved KB) · Status self-serve | Phase 1 acceptance gates green for 7 days |
| **Phase 2** (week 7–10) | Dine-in table flow · Razorpay payment links · Note-frequency analytics · Multi-language Hindi/Kannada copy | FAQ + Status stable; ≥40% peak channel share |
| **Phase 3** (month 3+) | Natural-language order capture (LLM tool-calling against deterministic cart service — LLM still NEVER prices) · Loyalty / repeat-customer broadcasts (with opt-in) · Multi-outlet support | Owner ready to scale to a second outlet |

---

## 18. The one-page summary (for the engineering kickoff)

> Build a Fastify webhook gateway that ACKs in <500ms and shoves every inbound onto a BullMQ queue. A worker reloads the session from Postgres, runs an XState machine, calls deterministic services for menu/cart/order, and enqueues an outbound message. The dashboard is a Next.js app that subscribes to Postgres changes via Supabase Realtime. Notes are sanitized free-text on `order_items.customer_note` and `orders.customer_note`. Three idempotency layers (webhook / order-create / outbound). No LLM in the order path. Walk-ins never touched. Ship in 4 weeks. Pilot only when every box in §15 is checked.

