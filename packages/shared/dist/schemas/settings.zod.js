"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsSchemas = void 0;
const zod_1 = require("zod");
exports.SettingsSchemas = {
    // Boolean kill switch for the whole digital lane
    digital_lane_paused: zod_1.z.boolean(),
    // Number of 'preparing' orders that triggers the rush ETA inflation
    rush_threshold: zod_1.z.number().int().min(1).max(100),
    // Multiplier applied to max prep time during a rush (e.g., 1.5x)
    eta_inflation_factor: zod_1.z.number().min(1.0).max(5.0),
    // Boolean switch to prepend rain messaging
    rain_protocol_active: zod_1.z.boolean(),
};
