INSERT INTO "brick_types" (
    "name", "length", "width", "height", "dimension_unit",
    "price_per_piece", "default_waste_percent", "is_active", "updated_at"
) VALUES
    ('Fly Ash Bricks', 9, 4.5, 3, 'INCH', 8.50, 0, true, CURRENT_TIMESTAMP),
    ('Solid Cement Blocks', 12, 8, 6, 'INCH', 42.00, 0, true, CURRENT_TIMESTAMP),
    ('Paver Blocks', 9, 4.5, 3, 'INCH', 55.00, 0, true, CURRENT_TIMESTAMP),
    ('Mud Bricks', 9, 4.5, 3, 'INCH', 12.00, 0, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
    "length" = EXCLUDED."length",
    "width" = EXCLUDED."width",
    "height" = EXCLUDED."height",
    "dimension_unit" = EXCLUDED."dimension_unit",
    "price_per_piece" = EXCLUDED."price_per_piece",
    "default_waste_percent" = EXCLUDED."default_waste_percent",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;
