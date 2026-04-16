CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PART 5: Vision Label Mappings — Multimodal Ingredient Detection
-- Veritabanı: AppDb
-- Çalıştırma: seed-part1-base.sql çalıştırıldıktan SONRA çalıştır
-- Session: Multimodal Ingredient Detection Plan — Session 2
-- ============================================================
-- UUID Serisi:
--   Yeni Ingredients  : ee000038-... (Patates), ee000039-... (Mantar), ee00003a-... (Kırmızı Biber)
--   VisionLabelMappings: vm000001-... → vm000100-... (100 mapping)
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- A) FAZ 1 EKSİK INGREDIENT'LAR
--    seed-part1-base.sql'de olmayan 3 ingredient ekleniyor.
-- ════════════════════════════════════════════════════════════

INSERT INTO "Ingredients" ("Id", "CanonicalName", "Name", "Aliases", "IsActive", "IsMandatory", "IsProhibited") VALUES
('ee000038-0000-0000-0000-000000000000', 'Patates',       'Patates',       '["patates","potato","potatoes","taze patates","haşlanmış patates"]'::jsonb,                    true, false, false),
('ee000039-0000-0000-0000-000000000000', 'Mantar',        'Mantar',        '["mantar","mushroom","mushrooms","kültür mantarı","şampinyon","champignon"]'::jsonb,           true, false, false),
('ee00003a-0000-0000-0000-000000000000', 'Kırmızı Biber', 'Kırmızı Biber', '["kırmızı biber","kirmizi biber","red pepper","red bell pepper","capsicum red","paprika"]'::jsonb, true, false, false)
ON CONFLICT ("Id") DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- B) VISION LABEL MAPPINGS — Faz 1 Seed
--    Her canonical ingredient için en yaygın detection label'ları.
--    IsApproved = true  → yüksek confidence, OpenAI bypass edilir
--    IsApproved = false → provisional, resolver confirmation gerekir
-- ════════════════════════════════════════════════════════════

INSERT INTO "VisionLabelMappings" ("Id", "RawLabel", "NormalizedLabel", "IngredientId", "ConfidenceThreshold", "IsApproved", "Notes", "CreatedAtUtc") VALUES

-- ─── Domates (ee00000b) ───
(gen_random_uuid(), 'tomato',            'tomato',            'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'tomatoes',          'tomatoes',          'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'domates',           'domates',           'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'cherry tomato',     'cherry tomato',     'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'kiraz domates',     'kiraz domates',     'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Salatalık (ee00000c) ───
(gen_random_uuid(), 'cucumber',          'cucumber',          'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'cucumbers',         'cucumbers',         'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'salatalık',         'salatalık',         'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'hıyar',             'hıyar',             'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Limon (ee00001f) ───
(gen_random_uuid(), 'lemon',             'lemon',             'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'lemons',            'lemons',            'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'limon',             'limon',             'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'lime',              'lime',              'ee00001f-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional (lime ≠ lemon)', NOW()),

-- ─── Marul (ee000015) ───
(gen_random_uuid(), 'lettuce',           'lettuce',           'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'romaine lettuce',   'romaine lettuce',   'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'iceberg lettuce',   'iceberg lettuce',   'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'marul',             'marul',             'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Tavuk Göğsü (ee000022) ───
(gen_random_uuid(), 'chicken breast',    'chicken breast',    'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'chicken',           'chicken',           'ee000022-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'raw chicken',       'raw chicken',       'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'tavuk göğsü',       'tavuk göğsü',       'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'tavuk',             'tavuk',             'ee000022-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'piliç',             'piliç',             'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yumurta (ee000021) ───
(gen_random_uuid(), 'egg',               'egg',               'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'eggs',              'eggs',              'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'yumurta',           'yumurta',           'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'chicken egg',       'chicken egg',       'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Muz (ee00001a) ───
(gen_random_uuid(), 'banana',            'banana',            'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'bananas',           'bananas',           'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'muz',               'muz',               'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Süt (ee000004) ───
(gen_random_uuid(), 'milk',              'milk',              'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'süt',               'süt',               'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'cow milk',          'cow milk',          'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'whole milk',        'whole milk',        'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yoğurt (ee000001) ───
(gen_random_uuid(), 'yogurt',            'yogurt',            'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'yoghurt',           'yoghurt',           'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'yoğurt',            'yoğurt',            'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'plain yogurt',      'plain yogurt',      'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Beyaz Peynir (ee000006) ───
(gen_random_uuid(), 'feta',              'feta',              'ee000006-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'feta cheese',       'feta cheese',       'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'white cheese',      'white cheese',      'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'beyaz peynir',      'beyaz peynir',      'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kaşar Peyniri (ee000007) ───
(gen_random_uuid(), 'yellow cheese',     'yellow cheese',     'ee000007-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'cheddar',           'cheddar',           'ee000007-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional', NOW()),
(gen_random_uuid(), 'kaşar',             'kaşar',             'ee000007-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'kaşar peyniri',     'kaşar peyniri',     'ee000007-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Biber (ee00000d) ───
(gen_random_uuid(), 'pepper',            'pepper',            'ee00000d-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'green pepper',      'green pepper',      'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'bell pepper',       'bell pepper',       'ee00000d-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'biber',             'biber',             'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'yeşil biber',       'yeşil biber',       'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kırmızı Biber (ee00003a) ───
(gen_random_uuid(), 'red pepper',        'red pepper',        'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'red bell pepper',   'red bell pepper',   'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'kırmızı biber',     'kırmızı biber',     'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'paprika',           'paprika',           'ee00003a-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),

-- ─── Soğan (ee00000e) ───
(gen_random_uuid(), 'onion',             'onion',             'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'onions',            'onions',            'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'soğan',             'soğan',             'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'red onion',         'red onion',         'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Sarımsak (ee00000f) ───
(gen_random_uuid(), 'garlic',            'garlic',            'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'garlic clove',      'garlic clove',      'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'sarımsak',          'sarımsak',          'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Patates (ee000038) ───
(gen_random_uuid(), 'potato',            'potato',            'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'potatoes',          'potatoes',          'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'patates',           'patates',           'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'sweet potato',      'sweet potato',      'ee000038-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional (sweet potato ≠ potato)', NOW()),

-- ─── Havuç (ee000012) ───
(gen_random_uuid(), 'carrot',            'carrot',            'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'carrots',           'carrots',           'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'havuç',             'havuç',             'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kabak (ee000014) ───
(gen_random_uuid(), 'zucchini',          'zucchini',          'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'courgette',         'courgette',         'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'kabak',             'kabak',             'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Brokoli (ee000011) ───
(gen_random_uuid(), 'broccoli',          'broccoli',          'ee000011-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'brokoli',           'brokoli',           'ee000011-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Elma (ee00001b) ───
(gen_random_uuid(), 'apple',             'apple',             'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'apples',            'apples',            'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'elma',              'elma',              'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Portakal (ee00001c) ───
(gen_random_uuid(), 'orange',            'orange',            'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'oranges',           'oranges',           'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'portakal',          'portakal',          'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Çilek (ee00001d) ───
(gen_random_uuid(), 'strawberry',        'strawberry',        'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'strawberries',      'strawberries',      'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'çilek',             'çilek',             'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yulaf (ee000027) ───
(gen_random_uuid(), 'oats',              'oats',              'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'rolled oats',       'rolled oats',       'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'oatmeal',           'oatmeal',           'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'yulaf',             'yulaf',             'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Pirinç (ee000028) ───
(gen_random_uuid(), 'rice',              'rice',              'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'white rice',        'white rice',        'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'pirinç',            'pirinç',            'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Makarna (ee00002a) ───
(gen_random_uuid(), 'pasta',             'pasta',             'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'spaghetti',         'spaghetti',         'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'penne',             'penne',             'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'makarna',           'makarna',           'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ton Balığı (ee000023) ───
(gen_random_uuid(), 'tuna',              'tuna',              'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'canned tuna',       'canned tuna',       'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'ton balığı',        'ton balığı',        'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ekmek (ee00002c) ───
(gen_random_uuid(), 'bread',             'bread',             'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'white bread',       'white bread',       'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'whole wheat bread', 'whole wheat bread', 'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'ekmek',             'ekmek',             'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Avokado (ee00001e) ───
(gen_random_uuid(), 'avocado',           'avocado',           'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'avocados',          'avocados',          'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'avokado',           'avokado',           'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ispanak (ee000010) ───
(gen_random_uuid(), 'spinach',           'spinach',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'baby spinach',      'baby spinach',      'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'ıspanak',           'ıspanak',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'ispanak',           'ispanak',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Mantar (ee000039) ───
(gen_random_uuid(), 'mushroom',          'mushroom',          'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'mushrooms',         'mushrooms',         'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'button mushroom',   'button mushroom',   'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'champignon',        'champignon',        'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'mantar',            'mantar',            'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
(gen_random_uuid(), 'şampinyon',         'şampinyon',         'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW())

ON CONFLICT ("Id") DO NOTHING;

COMMIT;

-- ============================================================
-- ÖZET
-- ============================================================
-- Eklenen kayıtlar:
--   Yeni Ingredients         : 3 adet (Patates, Mantar, Kırmızı Biber)
--   VisionLabelMappings      : 114 adet (Faz 1 tüm 30 ingredient için EN + TR etiketler)
--
-- Faz 1 coverage (30 ingredient):
--   Domates, Salatalık, Limon, Marul, Tavuk Göğsü, Yumurta, Muz,
--   Süt, Yoğurt, Beyaz Peynir, Kaşar Peyniri, Biber, Kırmızı Biber,
--   Soğan, Sarımsak, Patates, Havuç, Kabak, Brokoli, Elma,
--   Portakal, Çilek, Yulaf, Pirinç, Makarna, Ton Balığı, Ekmek,
--   Avokado, Ispanak, Mantar
--
-- Provisional mappings (IsApproved=false, require review):
--   lime → Limon   (different ingredient)
--   cheddar → Kaşar  (approximate)
--   sweet potato → Patates  (different ingredient)
-- ============================================================
