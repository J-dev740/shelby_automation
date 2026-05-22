-- 0004_menu_image_url.sql

ALTER TABLE menu_items
ADD COLUMN image_url text,
ADD COLUMN description text;
