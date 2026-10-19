ALTER TABLE products ADD COLUMN IF NOT EXISTS height_in numeric CHECK (height_in > 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_in numeric CHECK (width_in > 0);
-- Girder width and height are inches; length_ft remains feet.
-- width_ft is only used for slabs. Recipe quantities are per finished piece.
