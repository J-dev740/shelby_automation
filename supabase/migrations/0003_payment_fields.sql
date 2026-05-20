-- 0003_payment_fields.sql

ALTER TABLE orders
ADD COLUMN payment_intent_id text;
