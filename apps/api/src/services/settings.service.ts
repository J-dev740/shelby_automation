import { db } from '../lib/db.js';
import { z } from 'zod';

const settingsSchemas = {
  digital_lane_paused: z.boolean(),
  rush_threshold: z.number().int().min(1).max(100),
  eta_inflation_factor: z.number().min(1.0).max(5.0),
  rain_protocol_active: z.boolean(),
};

export type SettingKey = keyof typeof settingsSchemas;

export const settingsService = {
  async getSetting<K extends SettingKey>(key: K): Promise<z.infer<typeof settingsSchemas[K]> | null> {
    const res = await db.query(`SELECT value_json FROM system_settings WHERE key = $1`, [key]);
    if (res.rowCount === 0) return null;
    
    let value = res.rows[0].value_json;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Leave as string if not JSON parsable
      }
    }
    
    const schema = settingsSchemas[key];
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }
    return null;
  },

  async setSetting<K extends SettingKey>(key: K, value: z.infer<typeof settingsSchemas[K]>) {
    const schema = settingsSchemas[key];
    const validated = schema.parse(value);
    
    const res = await db.query(
      `INSERT INTO system_settings (key, value_json) 
       VALUES ($1, $2::jsonb) 
       ON CONFLICT (key) DO UPDATE SET value_json = $2::jsonb 
       RETURNING *`,
      [key, JSON.stringify(validated)]
    );
    return res.rows[0];
  },

  async isDigitalLanePaused(): Promise<boolean> {
    const paused = await this.getSetting('digital_lane_paused');
    return paused === true;
  }
};
