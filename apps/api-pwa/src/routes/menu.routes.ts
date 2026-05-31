import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { settingsService } from '../services/settings.service.js';

// API-side mapping: category slug → PWA type
const PWA_TYPE_MAP: Record<string, 'sips' | 'bites'> = {
  'cold-coffee': 'sips',
  'hot-coffee': 'sips',
  'teas': 'sips',
  'smoothies': 'sips',
  'food': 'bites',
  'add-ons': 'bites',
};

export async function menuRoutes(app: FastifyInstance) {
  app.get('/menu', async (request, reply) => {
    try {
      // Single query: categories + items
      const res = await db.query(
        `SELECT 
          mc.id as category_id,
          mc.name as category_name,
          mc.slug as category_slug,
          mc.sort_order,
          mi.id as item_id,
          mi.name as item_name,
          mi.description as item_description,
          mi.price_inr,
          mi.prep_time_min,
          mi.slug as item_slug
        FROM menu_categories mc
        LEFT JOIN menu_items mi ON mi.category_id = mc.id AND mi.active = true
        WHERE mc.active = true
        ORDER BY mc.sort_order, mi.sort_order`
      );

      // Group into sips/bites
      const sips: any[] = [];
      const bites: any[] = [];
      const seenItems = new Set<string>();

      for (const row of res.rows) {
        // Skip if no item (category with 0 active items)
        if (!row.item_id) continue;
        // Dedup
        if (seenItems.has(row.item_id)) continue;
        seenItems.add(row.item_id);

        const item = {
          id: row.item_id,
          name: row.item_name,
          description: row.item_description || '',
          price_inr: row.price_inr,
          prep_time_min: row.prep_time_min,
          category_name: row.category_name,
        };

        const slug = row.category_slug?.toLowerCase() || '';
        const name = row.category_name?.toLowerCase() || '';
        
        // Determine type based on explicit map, or fallback to fuzzy matching
        let pwaType = PWA_TYPE_MAP[slug];
        if (!pwaType) {
          if (slug.includes('food') || slug.includes('add-on') || slug.includes('extra') || slug.includes('bite') || slug.includes('special') || slug.includes('snack') || slug.includes('bakery') ||
              name.includes('food') || name.includes('add-on') || name.includes('bite') || name.includes('special') || name.includes('snack') || name.includes('bakery') || name.includes('dessert')) {
            pwaType = 'bites';
          } else {
            // Default to sips (drinks) for cafes since they have many drink categories
            pwaType = 'sips';
          }
        }

        if (pwaType === 'sips') {
          sips.push(item);
        } else {
          bites.push(item);
        }
      }

      const digitalLanePaused = await settingsService.isDigitalLanePaused();

      return {
        sips,
        bites,
        digital_lane_paused: digitalLanePaused,
      };
    } catch (err: any) {
      app.log.error(err, 'Failed to fetch menu');
      return reply.status(500).send({ error: 'Failed to fetch menu' });
    }
  });
}
