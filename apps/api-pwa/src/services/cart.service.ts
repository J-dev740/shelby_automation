import { db } from '../lib/db.js';
import { sanitizeNote } from './notes.sanitizer.js';

export class ItemUnavailableError extends Error {
  constructor(public itemId: string) {
    super(`Item ${itemId} is no longer available.`);
    this.name = 'ItemUnavailableError';
  }
}

export class ModifierValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModifierValidationError';
  }
}

// Represents the incoming unstructured cart from the user session
export interface RawCartLine {
  itemId: string;
  qty: number;
  modifierIds: string[];
  customerNote?: string;
}

// Represents the fully priced and validated cart
export interface PricedCartLine {
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  customerNote?: string;
  modifiers: {
    id: string;
    name: string;
    priceDelta: number;
  }[];
}

export interface PricedCart {
  lines: PricedCartLine[];
  subtotal: number;
  total: number; // For phase 1, subtotal == total. Later: taxes, delivery
  maxPrepTimeMin: number;
}

export async function priceCart(lines: RawCartLine[]): Promise<PricedCart> {
  if (lines.length === 0) {
    return { lines: [], subtotal: 0, total: 0, maxPrepTimeMin: 0 };
  }

  const itemIds = lines.map(l => l.itemId);
  const modifierIds = lines.flatMap(l => l.modifierIds);

  // 1. Fetch Items
  // We use Postgres ANY($1) to fetch all items at once.
  const itemsRes = await db.query(
    `SELECT id, name, price_inr, prep_time_min, active 
     FROM menu_items WHERE id = ANY($1::uuid[])`,
    [itemIds]
  );
  
  const itemsMap = new Map<string, any>();
  for (const row of itemsRes.rows) {
    itemsMap.set(row.id, row);
  }

  // 2. Fetch Modifiers & Groups
  // We need the group rules (min_select, max_select) to validate constraints.
  let modsMap = new Map<string, any>();
  let groupsMap = new Map<string, any>();

  if (modifierIds.length > 0) {
    const modsRes = await db.query(
      `SELECT m.id, m.name, m.price_delta_inr, m.active, 
              g.id as group_id, g.min_select, g.max_select 
       FROM modifiers m
       JOIN modifier_groups g ON m.group_id = g.id
       WHERE m.id = ANY($1::uuid[])`,
      [modifierIds]
    );

    for (const row of modsRes.rows) {
      modsMap.set(row.id, row);
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, { min: row.min_select, max: row.max_select, count: 0 });
      }
    }
  }

  const pricedLines: PricedCartLine[] = [];
  let subtotal = 0;
  let maxPrepTimeMin = 0;

  // 3. Process each line
  for (const line of lines) {
    const item = itemsMap.get(line.itemId);
    
    // Hard-fail if item doesn't exist or went inactive since it was added to cart
    if (!item || !item.active) {
      throw new ItemUnavailableError(line.itemId);
    }

    if (item.prep_time_min > maxPrepTimeMin) {
      maxPrepTimeMin = item.prep_time_min;
    }

    // Process Modifiers
    const lineModifiers: PricedCartLine['modifiers'] = [];
    let modifiersDeltaTotal = 0;
    const currentLineGroups = new Map(groupsMap); // Reset counts for this line

    for (const modId of line.modifierIds) {
      const mod = modsMap.get(modId);
      if (!mod || !mod.active) {
        throw new ItemUnavailableError(modId); // Treat inactive modifier as unavailable
      }

      lineModifiers.push({
        id: mod.id,
        name: mod.name,
        priceDelta: mod.price_delta_inr,
      });

      modifiersDeltaTotal += mod.price_delta_inr;

      const group = currentLineGroups.get(mod.group_id);
      if (group) group.count += 1;
    }

    // Validate modifier group limits (Max selection)
    // Note: Min selection requires checking all groups belonging to the item, 
    // which would require a separate query. For Phase 1 MVP, we enforce max.
    for (const [groupId, limits] of currentLineGroups.entries()) {
      if (limits.count > limits.max) {
        throw new ModifierValidationError(`Too many modifiers selected for group ${groupId}`);
      }
    }

    // Calculate line total
    const unitPriceWithMods = item.price_inr + modifiersDeltaTotal;
    const lineTotal = unitPriceWithMods * line.qty;
    subtotal += lineTotal;

    pricedLines.push({
      itemId: item.id,
      itemName: item.name,
      qty: line.qty,
      unitPrice: unitPriceWithMods,
      lineTotal,
      customerNote: sanitizeNote(line.customerNote, 'item'),
      modifiers: lineModifiers,
    });
  }

  return {
    lines: pricedLines,
    subtotal,
    total: subtotal,
    maxPrepTimeMin,
  };
}
