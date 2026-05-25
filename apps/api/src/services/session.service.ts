import { db } from '../lib/db.js';

export interface Customer {
  id: string;
  phone_e164: string;
  display_name: string | null;
}

// Old states kept temporarily for gradual migration (removed in Step 6)
export type SessionState =
  | 'idle'
  | 'browsing'
  | 'flow_active'
  | 'cart_review'
  | 'checkout'
  | 'handoff_active'
  // Legacy states — will be removed in Step 6
  | 'browsing_categories'
  | 'browsing_items'
  | 'ordering'
  | 'checkout_confirm';

export interface SessionContext {
  /** Last category ID the user was browsing (for Flow re-entry) */
  lastCategoryId?: string;
  /** Mapping of Flow item slots to menu_item UUIDs: { "1": "uuid", "2": "uuid", ... } */
  flow_item_map?: Record<string, string>;
  /** Notes from the last Flow submission */
  lastFlowNotes?: string;
}

export interface Session {
  id: string;
  customer_id: string;
  state: SessionState;
  cart_json: any[];
  context_json: SessionContext;
  last_activity_at: Date;
  created_at: Date;
}

/**
 * Safely reads context_json with null coalescing.
 * Handles: null, undefined, empty string, malformed data.
 */
export function getContext(session: Session): SessionContext {
  if (!session.context_json || typeof session.context_json !== 'object') {
    return {};
  }
  return session.context_json;
}

/**
 * Safely reads cart_json with null coalescing.
 * Handles: null, undefined, non-array values.
 */
export function getCart(session: Session): any[] {
  if (!Array.isArray(session.cart_json)) {
    return [];
  }
  return session.cart_json;
}

export const sessionService = {
  async getOrCreateCustomer(phone: string): Promise<Customer> {
    const getRes = await db.query(
      `SELECT * FROM customers WHERE phone_e164 = $1`,
      [phone]
    );

    if (getRes.rows.length > 0) {
      return getRes.rows[0];
    }

    const insertRes = await db.query(
      `INSERT INTO customers (phone_e164) VALUES ($1) RETURNING *`,
      [phone]
    );
    return insertRes.rows[0];
  },

  async getOrCreateSession(phone: string): Promise<Session> {
    const customer = await this.getOrCreateCustomer(phone);

    const getRes = await db.query(
      `SELECT * FROM sessions WHERE customer_id = $1 ORDER BY last_activity_at DESC LIMIT 1`,
      [customer.id]
    );

    if (getRes.rows.length > 0) {
      // Update last_activity_at
      const updateRes = await db.query(
        `UPDATE sessions SET last_activity_at = now() WHERE id = $1 RETURNING *`,
        [getRes.rows[0].id]
      );
      return updateRes.rows[0];
    }

    const insertRes = await db.query(
      `INSERT INTO sessions (customer_id, state, cart_json, context_json) 
       VALUES ($1, 'idle', '[]'::jsonb, '{}'::jsonb)
       RETURNING *`,
      [customer.id]
    );
    return insertRes.rows[0];
  },

  async updateSession(
    sessionId: string, 
    updates: { state?: string; cart_json?: any[]; context_json?: SessionContext }
  ): Promise<Session> {
    const setClauses: string[] = [];
    const values: any[] = [sessionId];
    let idx = 2;

    if (updates.state !== undefined) {
      setClauses.push(`state = $${idx++}`);
      values.push(updates.state);
    }
    
    if (updates.cart_json !== undefined) {
      setClauses.push(`cart_json = $${idx++}`);
      values.push(JSON.stringify(updates.cart_json));
    }

    if (updates.context_json !== undefined) {
      setClauses.push(`context_json = $${idx++}`);
      values.push(JSON.stringify(updates.context_json));
    }

    setClauses.push(`last_activity_at = now()`);

    const res = await db.query(
      `UPDATE sessions 
       SET ${setClauses.join(', ')} 
       WHERE id = $1 
       RETURNING *`,
      values
    );

    return res.rows[0];
  },

  /**
   * Merges partial updates into existing context_json using PostgreSQL's || operator.
   * This is atomic — safe for concurrent access.
   */
  async updateContext(
    sessionId: string, 
    updates: Partial<SessionContext>
  ): Promise<Session> {
    const res = await db.query(
      `UPDATE sessions 
       SET context_json = COALESCE(context_json, '{}'::jsonb) || $2::jsonb,
           last_activity_at = now()
       WHERE id = $1 
       RETURNING *`,
      [sessionId, JSON.stringify(updates)]
    );
    return res.rows[0];
  },

  async clearSession(sessionId: string): Promise<Session> {
    return this.updateSession(sessionId, { 
      state: 'idle', 
      cart_json: [], 
      context_json: {} 
    });
  }
};

