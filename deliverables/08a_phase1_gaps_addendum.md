# Phase 1 PRD Addendum — Critical Gaps

> **Purpose:** This document is the "page 2" to `08_phase1_order_fulfillment.md`. It tightens four critical gaps identified during the technical review that pose immediate risks to the Phase 1 pilot.

---

## 1. Handoff Flow Specification

The FSM diagram in the main PRD shows `[handoff_requested]` as a dead end. This specifies the exact behavior of that state.

### State Transition
When the intent classifier routes a message to `Handoff` (or when a user repeatedly fails classification):
1. **FSM State:** Session transitions to `handoff_active`.
2. **Bot Behavior:** The bot is now *parked* and silent. It will not attempt to classify or reply to any further messages from this user while in this state.

### Customer UX
Immediately upon entering `handoff_active`, the bot sends this exact message:
> *"I'm connecting you with the team — someone will reply here shortly. You can also walk up to the window anytime."*

### Staff UX
- The staff dashboard receives a realtime event.
- A red **"Staff Needed"** badge appears on the dashboard header.
- Clicking it opens the conversation drawer for that customer, allowing staff to type a manual reply.

### Timeout & Reset
- If no staff member replies within **10 minutes**, a CRON job (or BullMQ delayed job) executes.
- **Bot sends:** *"Sorry for the wait — things are a bit crazy right now! Please walk up to the window and we'll help you directly."*
- **State change:** The session is reset to `idle`.

---

## 2. WhatsApp Message Catalog (Error UX)

To prevent inconsistent messaging, every developer must use these exact strings for outbound system messages. No ad-hoc string concatenation.

| Trigger / Scenario | Message Template |
|---|---|
| **Kill Switch Active** (`digital_lane_paused=true`) | *"We're a bit slammed right now! 😅 Please walk up to the window to place your order."* |
| **Rain Mode Active** (Prepended to greetings) | *"☔ Looks like rain! We're moving as fast as we can safely."* |
| **Item Unavailable Mid-Cart** | *"Sorry, {{item_name}} just sold out! Let's get you something else."* (+ Renders Category List) |
| **Cart Exceeds ₹200 (Unpaid)** | *"Your total is {{total}}. For orders over ₹200, please pay via UPI here first: {{link}}"* |
| **Handoff Triggered** | *"I'm connecting you with the team — someone will reply here shortly. You can also walk up to the window anytime."* |
| **Handoff Timeout** (>10 min no staff reply) | *"Sorry for the wait — things are a bit crazy right now! Please walk up to the window and we'll help you directly."* |
| **Dormant Session Restart** (>30 min idle) | *"Welcome back! Do you want to start a new order?"* (+ Buttons: Order / Talk to staff) |
| **Out of Hours** | *"We're currently closed! Our hours are {{hours}}. See you tomorrow! 👋"* |
| **Fatal System Error** (Catch-all 500) | *"Oops, something went wrong on our end. Please order at the counter while we fix this!"* |

---

## 3. Environment Guardrails

To prevent the catastrophic scenario of dev traffic hitting production databases or real customers receiving test messages.

### Env Validation (`config/env.ts`)
Must enforce the following using Zod:
1. If `NODE_ENV === 'development'`, `SUPABASE_URL` **must** point to `localhost` or `127.0.0.1`. If it points to the production `.supabase.co` URL, the server *must crash on boot*.
2. If `NODE_ENV === 'development'`, `WHATSAPP_API_TOKEN` must be a test token, or a mock provider flag must be enabled.

### Provider Strategy
- **Local Dev:** Use `mock.provider.ts`. Outbound messages are simply `logger.info(payload)` instead of real HTTP calls.
- **Staging/Integration:** Use Meta's provided Sandbox/Test Number.
- **Production:** The real WABA (WhatsApp Business Account) number.

---

## 4. System Settings Validation

The `system_settings` table uses a raw `value_json` column. To prevent a bad admin dashboard write from crashing the orchestration logic, every key must be validated on read/write.

### Zod Schemas

```typescript
// packages/shared/src/schemas/settings.zod.ts
import { z } from 'zod';

export const SettingsSchemas = {
  // Boolean kill switch for the whole digital lane
  digital_lane_paused: z.boolean(),
  
  // Number of 'preparing' orders that triggers the rush ETA inflation
  rush_threshold: z.number().int().min(1).max(100),
  
  // Multiplier applied to max prep time during a rush (e.g., 1.5x)
  eta_inflation_factor: z.number().min(1.0).max(5.0),
  
  // Boolean switch to prepend rain messaging
  rain_protocol_active: z.boolean(),
};

// Type inference
export type SystemSettings = {
  [K in keyof typeof SettingsSchemas]: z.infer<typeof SettingsSchemas[K]>
};
```

**Implementation Rule:**
The settings API route (`PUT /api/settings/:key`) must parse the incoming payload through `SettingsSchemas[key].parse()` before executing the SQL `UPDATE`. If parsing fails, return `400 Bad Request`.
