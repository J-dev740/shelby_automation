import { db } from '../lib/db.js';

export interface Customer {
  id: string;
  phone_e164: string;
  display_name: string | null;
}

export interface Session {
  id: string;
  customer_id: string;
  state: 'idle' | 'ordering' | 'handoff_active';
  cart_json: any[];
  context_json: any;
  last_activity_at: Date;
  created_at: Date;
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
      `INSERT INTO sessions (customer_id, state, cart_json) 
       VALUES ($1, 'idle', '[]'::jsonb)
       RETURNING *`,
      [customer.id]
    );
    return insertRes.rows[0];
  },

  async updateSession(
    sessionId: string, 
    updates: { state?: string; cart_json?: any[] }
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

  async clearSession(sessionId: string): Promise<Session> {
    return this.updateSession(sessionId, { state: 'idle', cart_json: [] });
  }
};

