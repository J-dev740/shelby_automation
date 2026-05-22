# Shelby WhatsApp UX Upgrade Plan
## From "functional bot" → "premium conversational café experience"

---

## What High-End Brands Do Differently

Research into brands like Swiggy, Zomato, Nykaa, and luxury international players (Zara, Sephora) on WhatsApp reveals a consistent pattern:

| What Bad Bots Do | What Premium Brands Do |
|---|---|
| Plain text walls of menu items | **List Messages** with grouped categories |
| "Type 1 for coffee, 2 for tea" | **Reply Buttons** — tap, never type |
| Text-only order confirmation | **Image + bold order summary card** |
| No personality | Warm, on-brand copy with the café's voice |
| One message per item | **Carousels** — swipeable item cards with images |
| Generic payment link | Named CTA button: "Pay ₹349 →" |
| Silence after order | **Template notifications** at each status change |

The key insight: **every friction point where a user has to type something is a drop-off risk.** Premium brands eliminate typing entirely through interactive components.

---

## WhatsApp Message Types Available to Us

### 1. 📋 List Message (Interactive)
Best for: Category browsing, "What do you want to do?" moments
- Up to 10 rows grouped into sections
- Opens a native bottom sheet on the phone
- Single tap selection

**Use for:** Welcome menu, category picker, order history

### 2. 🔘 Reply Buttons (Interactive)
Best for: Binary/trinary decisions, confirmations
- Up to 3 tappable buttons
- Inline in the chat — no sheet opens
- Fastest UX possible

**Use for:** "Confirm order / Edit cart / Cancel", "Yes, place order / No, change something"

### 3. 🖼️ Image Message
Best for: Hero moments, product showcases
- Captioned image with up to 1024 chars
- Drives emotional connection to the product

**Use for:** Welcome card with café photo, item spotlight of the day

### 4. 🎠 Carousel (Interactive)
Best for: Browsing a category's items
- Horizontally scrollable cards
- Each card: image + title + body + 2 buttons
- The single most powerful UX upgrade available

**Use for:** "Here's our Cold Coffee menu 👇" — each drink gets its own swipeable card

### 5. 📄 Document / PDF
Best for: Full menu as a PDF
- Downloadable, saveable

**Use for:** Sending full printable menu on request

### 6. 📍 Location Message
Best for: Sharing café address
- Opens native maps app

**Use for:** "Find us → [Shelby HSR Layout, 25th B Main Rd]"

### 7. 🔔 Template Messages (HSM)
Best for: Business-initiated notifications (outside 24hr window)
- Must be pre-approved by Meta
- Only way to message users who haven't written recently

**Use for:** "Your order is ready ☕", payment receipt, daily special push

---

## Redesigned Conversation Flow

### Welcome (currently: plain text)

**Upgrade to:** Image message (café hero photo) + List Message

```
┌─────────────────────────────────────┐
│  [Shelby Café Photo — warm, moody]  │
│                                     │
│  Hey Rindra! 👋 Welcome to          │
│  *Shelby The Barista* ☕             │
│  HSR Layout's favourite coffee spot │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  What would you like to do?         │
│  ─────────────────────────────────  │
│  ☕ Order Now                        │
│  📋 View Full Menu                  │
│  🛒 My Cart                         │
│  📦 Track My Order                  │
│  📍 Find Us                         │
└─────────────────────────────────────┘
```

### Category Selection (currently: text list)

**Upgrade to:** List Message with emoji categories

```
┌─────────────────────────────────────┐
│  What are you craving today? 🤩     │
│                                     │
│  ── Our Menu ──────────────────     │
│  ❄️ Cold Coffee   (6 items)         │
│  ☕ Hot Coffee    (6 items)         │
│  🍵 Teas          (4 items)         │
│  🥤 Smoothies     (3 items)         │
│  🥪 Food          (6 items)         │
│  ✨ Add-ons        (3 items)        │
└─────────────────────────────────────┘
```

### Item Browsing (currently: text list — BIGGEST WIN)

**Upgrade to:** Carousel Message

```
❄️ Cold Coffee — tap to add to cart

[← swipe →]

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ [drink image]│ │ [drink image]│ │ [drink image]│
│              │ │              │ │              │
│ Classic Cold │ │  Hazelnut    │ │ Spanish Latte│
│   Coffee     │ │ Cold Coffee  │ │              │
│              │ │              │ │              │
│ Smooth, sweet│ │ Rich & silky │ │ Our bestseller│
│ house blend  │ │ hazelnut hit │ │ condensed milk│
│              │ │              │ │              │
│    ₹149      │ │    ₹179      │ │    ₹189      │
│ [Add to Cart]│ │ [Add to Cart]│ │ [Add to Cart]│
│ [Details]    │ │ [Details]    │ │ [Details]    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Cart Review (currently: text)

**Upgrade to:** Image + Reply Buttons

```
┌─────────────────────────────────────┐
│  🛒 Your Cart                       │
│  ─────────────────────────────────  │
│  1x Spanish Latte         ₹189      │
│  1x Banana Walnut Muffin   ₹89      │
│  ─────────────────────────────────  │
│  *Total: ₹278*                      │
│  Est. ready in ~8 mins ⏱️           │
└─────────────────────────────────────┘

  [✅ Place Order]  [✏️ Edit]  [❌ Cancel]
```

### Payment (currently: plain link)

**Upgrade to:** CTA Button message

```
┌─────────────────────────────────────┐
│  Almost there! 🎉                   │
│                                     │
│  Your order #SHB-042 is reserved    │
│  for the next *10 minutes*.         │
│                                     │
│  Tap below to complete payment:     │
│                                     │
│  [ 💳 Pay ₹278 Securely → ]        │
└─────────────────────────────────────┘
```

### Order Status Updates (Template Messages)

Three pre-approved templates to submit to Meta:

**1. Order Confirmed** (triggers: when order accepted)
```
✅ Order Confirmed — #SHB-{{order_code}}

Hey {{name}}! Your order is confirmed 
at Shelby The Barista ☕

Estimated ready time: ~{{eta}} mins
We'll ping you when it's ready!
```

**2. Order Ready** (triggers: when staff marks "Ready")
```
🔔 Your order is READY!

Hey {{name}}, *Order #SHB-{{order_code}}* 
is ready for pickup at the counter!

Come grab it while it's fresh ☕✨
```

**3. Daily Special** (marketing, opt-in only)
```
☀️ Today's Special at Shelby!

*{{item_name}}* — only ₹{{price}} today

Tap to order: [Order Now →]
```

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Carousel for item browsing | High | Massive |
| 🔴 P0 | Reply Buttons for cart confirm | Low | High |
| 🟡 P1 | List Message for categories | Low | High |
| 🟡 P1 | CTA Button for payment | Low | Medium |
| 🟢 P2 | Hero image on welcome | Low | Medium |
| 🟢 P2 | Template messages (order ready) | Medium | High |
| 🔵 P3 | Location message | Very Low | Low |
| 🔵 P3 | PDF full menu | Very Low | Low |

> [!IMPORTANT]
> **Carousel messages require using the Cloud API's `interactive` type with `type: "carousel"`.** This is only available on Meta's Cloud API (not on-premises). Our current setup uses the Cloud API so we are already compatible.
> 
> However, **carousel images must be hosted URLs** (not base64). We need a CDN or Supabase Storage bucket to host drink images before implementing carousels.

> [!NOTE]
> **Template messages** (Order Ready, Order Confirmed) need to be submitted to Meta for approval before use. Approval takes 1–3 business days. These are the most impactful for the end-to-end user experience.

---

## What We Need Before Building

1. **Drink photos** — real photos of Shelby's drinks (from their Instagram) to use in carousel cards. Even 400x400px works great on WhatsApp.
2. **Supabase Storage bucket** — to host those images at a public URL.
3. **Meta template approval** — submit "order_ready" and "order_confirmed" templates to Meta.

Once we have these, the carousel + button upgrades can be implemented in a focused sprint.
