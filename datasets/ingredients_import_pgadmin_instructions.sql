-- Option A: Run from Query Tool in pgAdmin after putting the CSV on the DB host/container path.
-- Replace the path below with the real absolute path visible to PostgreSQL.
COPY public."Ingredients"
("Id","Name","IsMandatory","IsProhibited","CanonicalName","Aliases","IsActive","IsCondiment")
FROM '/path/to/ingredients_tr_pgadmin_safe.csv'
WITH (
  FORMAT csv,
  HEADER false,
  DELIMITER ',',
  QUOTE '"',
  ESCAPE '"',
  ENCODING 'UTF8'
);

-- Option B: Safer import through a text staging table if you still get type/encoding issues.
-- CREATE TEMP TABLE ingredient_import_stage (
--   "Id" text,
--   "Name" text,
--   "IsMandatory" text,
--   "IsProhibited" text,
--   "CanonicalName" text,
--   "Aliases" text,
--   "IsActive" text,
--   "IsCondiment" text
-- );
-- COPY ingredient_import_stage FROM '/path/to/ingredients_tr_pgadmin_safe.csv'
-- WITH (FORMAT csv, HEADER false, DELIMITER ',', QUOTE '"', ESCAPE '"', ENCODING 'UTF8');
-- INSERT INTO public."Ingredients"
-- ("Id","Name","IsMandatory","IsProhibited","CanonicalName","Aliases","IsActive","IsCondiment")
-- SELECT
--   "Id"::uuid,
--   "Name"::varchar(200),
--   "IsMandatory"::boolean,
--   "IsProhibited"::boolean,
--   "CanonicalName"::varchar(200),
--   CASE WHEN COALESCE(NULLIF("Aliases", ''), '[]') = '' THEN NULL ELSE "Aliases"::jsonb END,
--   "IsActive"::boolean,
--   "IsCondiment"::boolean
-- FROM ingredient_import_stage;
