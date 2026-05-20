import { z } from 'zod';
export declare const modifierSelectionSchema: z.ZodObject<{
    modifierId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    modifierId: string;
}, {
    modifierId: string;
}>;
export declare const cartItemSchema: z.ZodObject<{
    itemId: z.ZodString;
    qty: z.ZodNumber;
    modifiers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        modifierId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        modifierId: string;
    }, {
        modifierId: string;
    }>, "many">>;
    customerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    itemId: string;
    qty: number;
    modifiers: {
        modifierId: string;
    }[];
    customerNote?: string | undefined;
}, {
    itemId: string;
    qty: number;
    modifiers?: {
        modifierId: string;
    }[] | undefined;
    customerNote?: string | undefined;
}>;
export declare const cartSchema: z.ZodObject<{
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        qty: z.ZodNumber;
        modifiers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            modifierId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            modifierId: string;
        }, {
            modifierId: string;
        }>, "many">>;
        customerNote: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        qty: number;
        modifiers: {
            modifierId: string;
        }[];
        customerNote?: string | undefined;
    }, {
        itemId: string;
        qty: number;
        modifiers?: {
            modifierId: string;
        }[] | undefined;
        customerNote?: string | undefined;
    }>, "many">>;
    customerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        itemId: string;
        qty: number;
        modifiers: {
            modifierId: string;
        }[];
        customerNote?: string | undefined;
    }[];
    customerNote?: string | undefined;
}, {
    customerNote?: string | undefined;
    items?: {
        itemId: string;
        qty: number;
        modifiers?: {
            modifierId: string;
        }[] | undefined;
        customerNote?: string | undefined;
    }[] | undefined;
}>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
