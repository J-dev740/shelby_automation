import { db } from '../lib/db.js';
import { settingsService } from './settings.service.js';

export async function computeEtaFactor(): Promise<number> {
  // 1. Count active orders in the kitchen
  const res = await db.query(
    `SELECT count(*) as active_count FROM orders WHERE state IN ('accepted', 'preparing')`
  );
  
  const activeCount = parseInt(res.rows[0].active_count, 10);
  
  // 2. Fetch thresholds from system_settings
  const threshold = (await settingsService.getSetting('rush_threshold')) ?? 15;
  const inflation = (await settingsService.getSetting('eta_inflation_factor')) ?? 1.5;
  
  // 3. Apply inflation if rushed
  if (activeCount > threshold) {
    return inflation;
  }
  
  return 1.0;
}
