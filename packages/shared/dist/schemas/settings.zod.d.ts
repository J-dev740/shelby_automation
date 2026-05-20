import { z } from 'zod';
export declare const SettingsSchemas: {
    digital_lane_paused: z.ZodBoolean;
    rush_threshold: z.ZodNumber;
    eta_inflation_factor: z.ZodNumber;
    rain_protocol_active: z.ZodBoolean;
};
export type SystemSettings = {
    [K in keyof typeof SettingsSchemas]: z.infer<typeof SettingsSchemas[K]>;
};
