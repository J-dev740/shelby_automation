"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartSchema = exports.cartItemSchema = exports.modifierSelectionSchema = void 0;
const zod_1 = require("zod");
exports.modifierSelectionSchema = zod_1.z.object({
    modifierId: zod_1.z.string().uuid(),
});
exports.cartItemSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    qty: zod_1.z.number().int().min(1).max(20),
    modifiers: zod_1.z.array(exports.modifierSelectionSchema).default([]),
    customerNote: zod_1.z.string().max(80).optional(),
});
exports.cartSchema = zod_1.z.object({
    items: zod_1.z.array(exports.cartItemSchema).default([]),
    customerNote: zod_1.z.string().max(140).optional(),
});
