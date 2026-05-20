# MENU CATALOG — Shelby the Barista (transcribed from boards, May 2026)

> Source: two photographed menu boards in `/Users/rindrajith/Desktop/shelby_whatsapp_automation`. Items marked `?` need owner confirmation. All prices in INR.

---

## How this maps to the system

Each item below seeds the `menu_categories`, `menu_items`, and (where relevant) `modifier_groups` tables defined in the PRD. Every item carries:
- `name` (display)
- `base_price_paise` (price × 100)
- `prep_time_min` (default below — owner to refine)
- `active` flag (toggled by staff dashboard)
- `tags` for filtering on WhatsApp

---

## Category 1 — MILK TEA

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Rose Tea | 40 | 3 | tea, milk, floral |
| Ginger Tea | 30 | 3 | tea, milk, classic |
| Normal Tea | 30 | 3 | tea, milk, plain |
| Masala Tea | 40 | 4 | tea, milk, spiced |
| Vanilla Tea | 40 | 3 | tea, milk, sweet |

## Category 2 — BLACK TEA

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Mint Black | 25 | 3 | tea, black, refreshing |
| Lemon Honey | 35 | 3 | tea, black, **must-try** |
| Clove Special | 30 | 3 | tea, black, spiced |

## Category 3 — MILK COFFEE

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Shelby Signature | 50 | 4 | coffee, milk, **signature**, must-try |
| Chocolate Coffee | 65 | 4 | coffee, milk, dessert, must-try |
| Vanilla Coffee | 70 | 4 | coffee, milk, sweet, must-try |
| Caramel Coffee | 70 | 4 | coffee, milk, sweet, must-try |
| Hazelnut Coffee | 70 | 4 | coffee, milk, nutty, must-try |

## Category 4 — BLACK COFFEE

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Black Coffee | 25 | 3 | coffee, black |
| Jaggery Blast | 25 | 3 | coffee, black, jaggery |
| Cinnamon-yana | 25 | 3 | coffee, black, spiced |

## Category 5 — SPECIAL

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Horlicks | 40 | 3 | special, malt |
| Boost | 40 | 3 | special, malt |
| Badam Milk | 35 | 3 | special, kids-friendly |
| Hot Chocolate | 80 | 5 | special, dessert, **must-try** |
| Boost on Rocks | 90 | 4 | special, cold |
| Horlicks on Rocks | 90 | 4 | special, cold |
| Premium Cold Coffee | 150 | 5 | special, cold, premium |

## Category 6 — ICED TEA

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Lemon Ice Tea | 80 | 3 | iced-tea, citrus |
| Peach Ice Tea | 80 | 3 | iced-tea, fruity |
| Passion Fruit Ice Tea | 80 | 3 | iced-tea, fruity |
| Elder Flower Ice Tea | 95 | 4 | iced-tea, floral, premium |

## Category 7 — COLD COFFEE

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Premium Cold Coffee | 150 | 5 | cold-coffee, premium |
| Hazelnut Cold Coffee | 180 | 5 | cold-coffee, nutty, flavored |
| Vanilla Cold Coffee | 180 | 5 | cold-coffee, sweet, flavored |
| Caramel Cold Coffee | 180 | 5 | cold-coffee, sweet, flavored |
| Irish Cold Coffee | 180 | 5 | cold-coffee, signature |

## Category 8 — MOJITO (all ₹90)

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Watermelon Mojito | 90 | 4 | mojito, fruity |
| Passion Fruit Mojito | 90 | 4 | mojito, fruity |
| Strawberry Mojito | 90 | 4 | mojito, fruity |
| Orange Mojito | 90 | 4 | mojito, citrus |
| Mango Mojito | 90 | 4 | mojito, fruity |
| Virgin Mojito | 90 | 4 | mojito, classic |
| Kala Khatta Mojito | 90 | 4 | mojito, indian |

## Category 9 — SODA

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Lime Soda | 50 | 2 | soda, refreshing |

## Category 10 — SMOOTHY

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Mango Pulpy Smoothy | 120 | 5 | smoothy, fruity |

## Category 11 — BAKERY (from research, please confirm prices)

| Name | Price | Default prep (min) | Tags |
|---|---:|---:|---|
| Korean Cream Cheese Bun — Classic `?` | TBD | 2 | bakery, trend, hot-mover |
| Korean Cream Cheese Bun — Mushroom `?` | TBD | 2 | bakery, trend, hot-mover |

---

## Cross-cutting modifier groups (proposed)

| Group | Applies to | Options | Required? |
|---|---|---|---|
| Sweetness | All teas, all coffees | Less sweet, Regular, Extra sweet | optional, max 1 |
| Milk type | Milk tea, milk coffee, cold coffee | Regular dairy, Oat (+₹50) `?` | optional, max 1 |
| Ice level | All cold drinks | Less ice, Regular, Extra ice | optional, max 1 |
| Strength | All coffees | Single shot, Double shot (+₹20) `?` | optional, max 1 |
| Take-away | All items | Stay (sidewalk), Take-away | required, exactly 1 |

## Curated "Must-try" shortcut on WhatsApp

Surfaced as a one-tap quick-reply on the bot's main menu: **Coffees · Hot Chocolate · Lemon Honey** — directly mirrors the on-board hand-written prompt.

## Operational flags (set & toggled by staff)

- `active` (boolean) — pause an item across the entire WhatsApp channel
- `low_stock` (boolean, optional Phase 2) — show "Almost out" badge

## Open items for owner sign-off

1. Confirm `Horlicks on Rocks` price (board ambiguity — likely ₹90 by parallel with `Boost on Rocks`).
2. Confirm whether **Korean Cream Cheese Buns** (Mushroom / Classic) are still on offer + their prices — mentioned in research dossier, not on either board.
3. Confirm modifier group prices (oat milk surcharge, double-shot surcharge).
4. Decide if the bot should expose **Premium Cold Coffee** under both *Special* and *Cold Coffee* (it appears on both boards). **Recommendation:** list only under *Cold Coffee* to avoid duplicates.
5. Clarify the entry handwritten as **"Boast-40"** between the Black Coffee block and the Special block — most likely a placement of the **Boost (₹40)** item in the Special section. Confirm this is not a separate drink we're missing.
6. Confirm **Vanilla Coffee (₹70)** is on the current menu (faint on the glass-covered board due to reflection — present in our catalog under Milk Coffee).
