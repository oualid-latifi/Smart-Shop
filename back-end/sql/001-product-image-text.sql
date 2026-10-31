-- Run once on the SmartShop PostgreSQL database before saving camera photos.
-- This safely preserves existing image URLs while allowing larger base64 photo data.
ALTER TABLE IF EXISTS products
    ALTER COLUMN image_url TYPE TEXT USING image_url::TEXT;
