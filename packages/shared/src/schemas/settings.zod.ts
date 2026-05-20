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

export type SystemSettings = {
  [K in keyof typeof SettingsSchemas]: z.infer<typeof SettingsSchemas[K]>
};
