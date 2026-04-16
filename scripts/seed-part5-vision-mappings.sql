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
('vm000001-0000-0000-0000-000000000000', 'tomato',            'tomato',            'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000002-0000-0000-0000-000000000000', 'tomatoes',          'tomatoes',          'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000003-0000-0000-0000-000000000000', 'domates',           'domates',           'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000004-0000-0000-0000-000000000000', 'cherry tomato',     'cherry tomato',     'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000005-0000-0000-0000-000000000000', 'kiraz domates',     'kiraz domates',     'ee00000b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Salatalık (ee00000c) ───
('vm000006-0000-0000-0000-000000000000', 'cucumber',          'cucumber',          'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000007-0000-0000-0000-000000000000', 'cucumbers',         'cucumbers',         'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000008-0000-0000-0000-000000000000', 'salatalık',         'salatalık',         'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000009-0000-0000-0000-000000000000', 'hıyar',             'hıyar',             'ee00000c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Limon (ee00001f) ───
('vm00000a-0000-0000-0000-000000000000', 'lemon',             'lemon',             'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00000b-0000-0000-0000-000000000000', 'lemons',            'lemons',            'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00000c-0000-0000-0000-000000000000', 'limon',             'limon',             'ee00001f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00000d-0000-0000-0000-000000000000', 'lime',              'lime',              'ee00001f-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional (lime ≠ lemon)', NOW()),

-- ─── Marul (ee000015) ───
('vm00000e-0000-0000-0000-000000000000', 'lettuce',           'lettuce',           'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00000f-0000-0000-0000-000000000000', 'romaine lettuce',   'romaine lettuce',   'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000010-0000-0000-0000-000000000000', 'iceberg lettuce',   'iceberg lettuce',   'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000011-0000-0000-0000-000000000000', 'marul',             'marul',             'ee000015-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Tavuk Göğsü (ee000022) ───
('vm000012-0000-0000-0000-000000000000', 'chicken breast',    'chicken breast',    'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000013-0000-0000-0000-000000000000', 'chicken',           'chicken',           'ee000022-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm000014-0000-0000-0000-000000000000', 'raw chicken',       'raw chicken',       'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000015-0000-0000-0000-000000000000', 'tavuk göğsü',       'tavuk göğsü',       'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000016-0000-0000-0000-000000000000', 'tavuk',             'tavuk',             'ee000022-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm000017-0000-0000-0000-000000000000', 'piliç',             'piliç',             'ee000022-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yumurta (ee000021) ───
('vm000018-0000-0000-0000-000000000000', 'egg',               'egg',               'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000019-0000-0000-0000-000000000000', 'eggs',              'eggs',              'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00001a-0000-0000-0000-000000000000', 'yumurta',           'yumurta',           'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00001b-0000-0000-0000-000000000000', 'chicken egg',       'chicken egg',       'ee000021-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Muz (ee00001a) ───
('vm00001c-0000-0000-0000-000000000000', 'banana',            'banana',            'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00001d-0000-0000-0000-000000000000', 'bananas',           'bananas',           'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00001e-0000-0000-0000-000000000000', 'muz',               'muz',               'ee00001a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Süt (ee000004) ───
('vm00001f-0000-0000-0000-000000000000', 'milk',              'milk',              'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000020-0000-0000-0000-000000000000', 'süt',               'süt',               'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000021-0000-0000-0000-000000000000', 'cow milk',          'cow milk',          'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000022-0000-0000-0000-000000000000', 'whole milk',        'whole milk',        'ee000004-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yoğurt (ee000001) ───
('vm000023-0000-0000-0000-000000000000', 'yogurt',            'yogurt',            'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000024-0000-0000-0000-000000000000', 'yoghurt',           'yoghurt',           'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000025-0000-0000-0000-000000000000', 'yoğurt',            'yoğurt',            'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000026-0000-0000-0000-000000000000', 'plain yogurt',      'plain yogurt',      'ee000001-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Beyaz Peynir (ee000006) ───
('vm000027-0000-0000-0000-000000000000', 'feta',              'feta',              'ee000006-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm000028-0000-0000-0000-000000000000', 'feta cheese',       'feta cheese',       'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000029-0000-0000-0000-000000000000', 'white cheese',      'white cheese',      'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00002a-0000-0000-0000-000000000000', 'beyaz peynir',      'beyaz peynir',      'ee000006-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kaşar Peyniri (ee000007) ───
('vm00002b-0000-0000-0000-000000000000', 'yellow cheese',     'yellow cheese',     'ee000007-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm00002c-0000-0000-0000-000000000000', 'cheddar',           'cheddar',           'ee000007-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional', NOW()),
('vm00002d-0000-0000-0000-000000000000', 'kaşar',             'kaşar',             'ee000007-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00002e-0000-0000-0000-000000000000', 'kaşar peyniri',     'kaşar peyniri',     'ee000007-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Biber (ee00000d) ───
('vm00002f-0000-0000-0000-000000000000', 'pepper',            'pepper',            'ee00000d-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm000030-0000-0000-0000-000000000000', 'green pepper',      'green pepper',      'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000031-0000-0000-0000-000000000000', 'bell pepper',       'bell pepper',       'ee00000d-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),
('vm000032-0000-0000-0000-000000000000', 'biber',             'biber',             'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000033-0000-0000-0000-000000000000', 'yeşil biber',       'yeşil biber',       'ee00000d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kırmızı Biber (ee00003a) ───
('vm000034-0000-0000-0000-000000000000', 'red pepper',        'red pepper',        'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000035-0000-0000-0000-000000000000', 'red bell pepper',   'red bell pepper',   'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000036-0000-0000-0000-000000000000', 'kırmızı biber',     'kırmızı biber',     'ee00003a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000037-0000-0000-0000-000000000000', 'paprika',           'paprika',           'ee00003a-0000-0000-0000-000000000000', 0.65, true,  'Faz 1 seed', NOW()),

-- ─── Soğan (ee00000e) ───
('vm000038-0000-0000-0000-000000000000', 'onion',             'onion',             'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000039-0000-0000-0000-000000000000', 'onions',            'onions',            'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00003a-0000-0000-0000-000000000000', 'soğan',             'soğan',             'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00003b-0000-0000-0000-000000000000', 'red onion',         'red onion',         'ee00000e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Sarımsak (ee00000f) ───
('vm00003c-0000-0000-0000-000000000000', 'garlic',            'garlic',            'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00003d-0000-0000-0000-000000000000', 'garlic clove',      'garlic clove',      'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00003e-0000-0000-0000-000000000000', 'sarımsak',          'sarımsak',          'ee00000f-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Patates (ee000038) ───
('vm00003f-0000-0000-0000-000000000000', 'potato',            'potato',            'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000040-0000-0000-0000-000000000000', 'potatoes',          'potatoes',          'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000041-0000-0000-0000-000000000000', 'patates',           'patates',           'ee000038-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000042-0000-0000-0000-000000000000', 'sweet potato',      'sweet potato',      'ee000038-0000-0000-0000-000000000000', 0.60, false, 'Faz 1 seed — provisional (sweet potato ≠ potato)', NOW()),

-- ─── Havuç (ee000012) ───
('vm000043-0000-0000-0000-000000000000', 'carrot',            'carrot',            'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000044-0000-0000-0000-000000000000', 'carrots',           'carrots',           'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000045-0000-0000-0000-000000000000', 'havuç',             'havuç',             'ee000012-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Kabak (ee000014) ───
('vm000046-0000-0000-0000-000000000000', 'zucchini',          'zucchini',          'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000047-0000-0000-0000-000000000000', 'courgette',         'courgette',         'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000048-0000-0000-0000-000000000000', 'kabak',             'kabak',             'ee000014-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Brokoli (ee000011) ───
('vm000049-0000-0000-0000-000000000000', 'broccoli',          'broccoli',          'ee000011-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00004a-0000-0000-0000-000000000000', 'brokoli',           'brokoli',           'ee000011-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Elma (ee00001b) ───
('vm00004b-0000-0000-0000-000000000000', 'apple',             'apple',             'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00004c-0000-0000-0000-000000000000', 'apples',            'apples',            'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00004d-0000-0000-0000-000000000000', 'elma',              'elma',              'ee00001b-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Portakal (ee00001c) ───
('vm00004e-0000-0000-0000-000000000000', 'orange',            'orange',            'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00004f-0000-0000-0000-000000000000', 'oranges',           'oranges',           'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000050-0000-0000-0000-000000000000', 'portakal',          'portakal',          'ee00001c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Çilek (ee00001d) ───
('vm000051-0000-0000-0000-000000000000', 'strawberry',        'strawberry',        'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000052-0000-0000-0000-000000000000', 'strawberries',      'strawberries',      'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000053-0000-0000-0000-000000000000', 'çilek',             'çilek',             'ee00001d-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Yulaf (ee000027) ───
('vm000054-0000-0000-0000-000000000000', 'oats',              'oats',              'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000055-0000-0000-0000-000000000000', 'rolled oats',       'rolled oats',       'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000056-0000-0000-0000-000000000000', 'oatmeal',           'oatmeal',           'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000057-0000-0000-0000-000000000000', 'yulaf',             'yulaf',             'ee000027-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Pirinç (ee000028) ───
('vm000058-0000-0000-0000-000000000000', 'rice',              'rice',              'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000059-0000-0000-0000-000000000000', 'white rice',        'white rice',        'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00005a-0000-0000-0000-000000000000', 'pirinç',            'pirinç',            'ee000028-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Makarna (ee00002a) ───
('vm00005b-0000-0000-0000-000000000000', 'pasta',             'pasta',             'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00005c-0000-0000-0000-000000000000', 'spaghetti',         'spaghetti',         'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00005d-0000-0000-0000-000000000000', 'penne',             'penne',             'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00005e-0000-0000-0000-000000000000', 'makarna',           'makarna',           'ee00002a-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ton Balığı (ee000023) ───
('vm00005f-0000-0000-0000-000000000000', 'tuna',              'tuna',              'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000060-0000-0000-0000-000000000000', 'canned tuna',       'canned tuna',       'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000061-0000-0000-0000-000000000000', 'ton balığı',        'ton balığı',        'ee000023-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ekmek (ee00002c) ───
('vm000062-0000-0000-0000-000000000000', 'bread',             'bread',             'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000063-0000-0000-0000-000000000000', 'white bread',       'white bread',       'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000064-0000-0000-0000-000000000000', 'whole wheat bread', 'whole wheat bread', 'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000065-0000-0000-0000-000000000000', 'ekmek',             'ekmek',             'ee00002c-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Avokado (ee00001e) ───
('vm000066-0000-0000-0000-000000000000', 'avocado',           'avocado',           'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000067-0000-0000-0000-000000000000', 'avocados',          'avocados',          'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000068-0000-0000-0000-000000000000', 'avokado',           'avokado',           'ee00001e-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Ispanak (ee000010) ───
('vm000069-0000-0000-0000-000000000000', 'spinach',           'spinach',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00006a-0000-0000-0000-000000000000', 'baby spinach',      'baby spinach',      'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00006b-0000-0000-0000-000000000000', 'ıspanak',           'ıspanak',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00006c-0000-0000-0000-000000000000', 'ispanak',           'ispanak',           'ee000010-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),

-- ─── Mantar (ee000039) ───
('vm00006d-0000-0000-0000-000000000000', 'mushroom',          'mushroom',          'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00006e-0000-0000-0000-000000000000', 'mushrooms',         'mushrooms',         'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm00006f-0000-0000-0000-000000000000', 'button mushroom',   'button mushroom',   'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000070-0000-0000-0000-000000000000', 'champignon',        'champignon',        'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000071-0000-0000-0000-000000000000', 'mantar',            'mantar',            'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW()),
('vm000072-0000-0000-0000-000000000000', 'şampinyon',         'şampinyon',         'ee000039-0000-0000-0000-000000000000', 0.70, true,  'Faz 1 seed', NOW())

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
