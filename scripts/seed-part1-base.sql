-- ============================================================
-- PART 1: Temel Tablolar — Ingredients, Families, Compat Rules
-- Veritabanı: AppDb
-- Çalıştırma: AppDb bağlantısında çalıştır
-- ============================================================
-- UUID Referans:
--   Ingredients : ee000001-...-000000000000 (i01) ... ee000037-...-000000000037 (i55)
--   Families    : ff000001-...-000000000000 (f01) ... ff000008-...-000000000008 (f08)
--   CompRules   : ca000001-...-000000000000 (cr01) ... ca000011-...-000000000011 (cr17)
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- A) INGREDIENTS (55 adet)
-- ════════════════════════════════════════════════════════════

INSERT INTO "Ingredients" ("Id", "CanonicalName", "Name", "Aliases", "IsActive", "IsMandatory", "IsProhibited") VALUES

-- ─── Süt Ürünleri (1-10) ───
('ee000001-0000-0000-0000-000000000000', 'Yoğurt',          'Yoğurt',          '["yogurt","yoğurt","yoghurt","plain yogurt","sade yoğurt"]'::jsonb,                                           true, false, false),
('ee000002-0000-0000-0000-000000000000', 'Süzme Yoğurt',    'Süzme Yoğurt',    '["suzme yogurt","suzme yoğurt","greek yogurt","labne","thick yogurt","koyu yoğurt","süzme yogurt"]'::jsonb,  true, false, false),
('ee000003-0000-0000-0000-000000000000', 'Kefir',            'Kefir',            '["kefir","kefir sütü","kefer"]'::jsonb,                                                                      true, false, false),
('ee000004-0000-0000-0000-000000000000', 'Süt',              'Süt',              '["sut","süt","milk","tam yağlı süt","inek sütü"]'::jsonb,                                                    true, false, false),
('ee000005-0000-0000-0000-000000000000', 'Lor Peyniri',      'Lor Peyniri',      '["lor","lor peynir","ricotta","taze peynir","çökelek"]'::jsonb,                                              true, false, false),
('ee000006-0000-0000-0000-000000000000', 'Beyaz Peynir',     'Beyaz Peynir',     '["beyaz peynir","taze beyaz peynir","feta","tulum benzeri"]'::jsonb,                                         true, false, false),
('ee000007-0000-0000-0000-000000000000', 'Kaşar Peyniri',   'Kaşar Peyniri',   '["kaşar","kasar","kaşar peynir","sarı peynir","dilimli peynir"]'::jsonb,                                    true, false, false),
('ee000008-0000-0000-0000-000000000000', 'Tulum Peyniri',    'Tulum Peyniri',    '["tulum","tulum peynir","koyun peyniri"]'::jsonb,                                                            true, false, false),
('ee000009-0000-0000-0000-000000000000', 'Tereyağı',        'Tereyağı',        '["tereyagi","tereyağı","butter","margarin","yağ"]'::jsonb,                                                  true, false, false),
('ee00000a-0000-0000-0000-000000000000', 'Krema',            'Krema',            '["krema","çiğ krema","whipping cream","heavy cream"]'::jsonb,                                                 true, false, false),

-- ─── Sebzeler (11-25) ───
('ee00000b-0000-0000-0000-000000000000', 'Domates',          'Domates',          '["domates","tomato","tomat","kiraz domates","salça"]'::jsonb,                                                 true, false, false),
('ee00000c-0000-0000-0000-000000000000', 'Salatalık',       'Salatalık',       '["salatalik","salatalık","cucumber","hıyar","hiyar"]'::jsonb,                                               true, false, false),
('ee00000d-0000-0000-0000-000000000000', 'Biber',            'Biber',            '["biber","yeşil biber","yesil biber","capsicum","pepper","dolmalık biber","sivri biber"]'::jsonb,           true, false, false),
('ee00000e-0000-0000-0000-000000000000', 'Soğan',           'Soğan',           '["sogan","soğan","onion","kuru soğan","kırmızı soğan"]'::jsonb,                                            true, false, false),
('ee00000f-0000-0000-0000-000000000000', 'Sarımsak',        'Sarımsak',        '["sarımsak","sarimsak","garlic","taze sarımsak","ezilmiş sarımsak"]'::jsonb,                               true, false, false),
('ee000010-0000-0000-0000-000000000000', 'Ispanak',          'Ispanak',          '["ispanak","ıspanak","spinach","taze ıspanak"]'::jsonb,                                                      true, false, false),
('ee000011-0000-0000-0000-000000000000', 'Brokoli',          'Brokoli',          '["brokoli","broccoli","brokoli çiçeği"]'::jsonb,                                                             true, false, false),
('ee000012-0000-0000-0000-000000000000', 'Havuç',           'Havuç',           '["havuç","havuc","carrot","taze havuç","bebek havuç"]'::jsonb,                                             true, false, false),
('ee000013-0000-0000-0000-000000000000', 'Patlıcan',        'Patlıcan',        '["patlican","patlıcan","eggplant","aubergine","kemer patlıcan"]'::jsonb,                                    true, false, false),
('ee000014-0000-0000-0000-000000000000', 'Kabak',            'Kabak',            '["kabak","zucchini","kabak çiçeği","sakız kabağı"]'::jsonb,                                                  true, false, false),
('ee000015-0000-0000-0000-000000000000', 'Marul',            'Marul',            '["marul","lettuce","yeşil marul","romaine","kıvırcık marul"]'::jsonb,                                        true, false, false),
('ee000016-0000-0000-0000-000000000000', 'Roka',             'Roka',             '["roka","rocket","arugula","taze roka"]'::jsonb,                                                              true, false, false),
('ee000017-0000-0000-0000-000000000000', 'Maydanoz',         'Maydanoz',         '["maydanoz","parsley","taze maydanoz","kıvırcık maydanoz"]'::jsonb,                                          true, false, false),
('ee000018-0000-0000-0000-000000000000', 'Dereotu',          'Dereotu',          '["dereotu","dill","taze dereotu","kurutulmuş dereotu"]'::jsonb,                                               true, false, false),
('ee000019-0000-0000-0000-000000000000', 'Nane',             'Nane',             '["nane","mint","taze nane","spearmint"]'::jsonb,                                                              true, false, false),

-- ─── Meyveler (26-32) ───
('ee00001a-0000-0000-0000-000000000000', 'Muz',              'Muz',              '["muz","banana","taze muz","olgun muz"]'::jsonb,                                                              true, false, false),
('ee00001b-0000-0000-0000-000000000000', 'Elma',             'Elma',             '["elma","apple","taze elma","yeşil elma"]'::jsonb,                                                           true, false, false),
('ee00001c-0000-0000-0000-000000000000', 'Portakal',         'Portakal',         '["portakal","orange","taze portakal","sıkma portakal"]'::jsonb,                                               true, false, false),
('ee00001d-0000-0000-0000-000000000000', 'Çilek',           'Çilek',           '["çilek","cilek","strawberry","taze çilek"]'::jsonb,                                                        true, false, false),
('ee00001e-0000-0000-0000-000000000000', 'Avokado',          'Avokado',          '["avokado","avocado","olgun avokado"]'::jsonb,                                                                true, false, false),
('ee00001f-0000-0000-0000-000000000000', 'Limon',            'Limon',            '["limon","lemon","taze limon","limon suyu"]'::jsonb,                                                          true, false, false),
('ee000020-0000-0000-0000-000000000000', 'Kivi',             'Kivi',             '["kivi","kiwi","taze kivi"]'::jsonb,                                                                          true, false, false),

-- ─── Proteinler (33-38) ───
('ee000021-0000-0000-0000-000000000000', 'Yumurta',          'Yumurta',          '["yumurta","egg","tam yumurta","büyük yumurta","organik yumurta"]'::jsonb,                                   true, false, false),
('ee000022-0000-0000-0000-000000000000', 'Tavuk Göğsü',    'Tavuk Göğsü',    '["tavuk gogsu","tavuk göğsü","tavuk","chicken breast","piliç","piliç göğsü","chicken"]'::jsonb,          true, false, false),
('ee000023-0000-0000-0000-000000000000', 'Ton Balığı',      'Ton Balığı',      '["ton baligi","ton balığı","tuna","ton balık","light ton","sardalye benzeri"]'::jsonb,                      true, false, false),
('ee000024-0000-0000-0000-000000000000', 'Kıyma',           'Kıyma',           '["kiyma","kıyma","mince","dana kıyma","karışık kıyma","ground beef"]'::jsonb,                             true, false, false),
('ee000025-0000-0000-0000-000000000000', 'Somon',            'Somon',            '["somon","salmon","somon fileto","taze somon"]'::jsonb,                                                       true, false, false),
('ee000026-0000-0000-0000-000000000000', 'Hindi Göğsü',    'Hindi Göğsü',    '["hindi gogsu","hindi göğsü","hindi","turkey breast","piliç muadili"]'::jsonb,                            true, false, false),

-- ─── Tahıllar (39-45) ───
('ee000027-0000-0000-0000-000000000000', 'Yulaf',            'Yulaf',            '["yulaf","oat","oats","yulaf ezmesi","rolled oats"]'::jsonb,                                                  true, false, false),
('ee000028-0000-0000-0000-000000000000', 'Pirinç',          'Pirinç',          '["pirinç","pirinc","rice","baldo pirinç","uzun taneli pirinç"]'::jsonb,                                    true, false, false),
('ee000029-0000-0000-0000-000000000000', 'Bulgur',           'Bulgur',           '["bulgur","bulgur pilavı","broken wheat","ince bulgur"]'::jsonb,                                              true, false, false),
('ee00002a-0000-0000-0000-000000000000', 'Makarna',          'Makarna',          '["makarna","pasta","spagetti","spaghetti","penne","erişte"]'::jsonb,                                          true, false, false),
('ee00002b-0000-0000-0000-000000000000', 'Kinoa',            'Kinoa',            '["kinoa","quinoa","tane kinoa"]'::jsonb,                                                                       true, false, false),
('ee00002c-0000-0000-0000-000000000000', 'Ekmek',            'Ekmek',            '["ekmek","bread","tam buğday ekmek","kepekli ekmek","tost ekmeği"]'::jsonb,                                  true, false, false),
('ee00002d-0000-0000-0000-000000000000', 'Un',               'Un',               '["un","flour","buğday unu","tam buğday unu"]'::jsonb,                                                         true, false, false),

-- ─── Baklagiller (46-48) ───
('ee00002e-0000-0000-0000-000000000000', 'Kırmızı Mercimek','Kırmızı Mercimek','["kırmızı mercimek","kirmizi mercimek","red lentil","mercimek","orange lentil"]'::jsonb,                  true, false, false),
('ee00002f-0000-0000-0000-000000000000', 'Nohut',            'Nohut',            '["nohut","chickpea","garbanzo","haşlanmış nohut"]'::jsonb,                                                    true, false, false),
('ee000030-0000-0000-0000-000000000000', 'Kuru Fasulye',     'Kuru Fasulye',     '["kuru fasulye","fasulye","haricot bean","white bean","pinto bean"]'::jsonb,                                  true, false, false),

-- ─── Yağ & Baharat & Diğer (49-55) ───
('ee000031-0000-0000-0000-000000000000', 'Zeytinyağı',      'Zeytinyağı',      '["zeytinyagi","zeytinyağı","olive oil","sızma zeytinyağı","extra virgin olive oil"]'::jsonb,             true, false, false),
('ee000032-0000-0000-0000-000000000000', 'Zeytin',           'Zeytin',           '["zeytin","olive","siyah zeytin","yeşil zeytin","sofralık zeytin"]'::jsonb,                                   true, false, false),
('ee000033-0000-0000-0000-000000000000', 'Bal',              'Bal',              '["bal","honey","çiçek balı","saf bal"]'::jsonb,                                                                true, false, false),
('ee000034-0000-0000-0000-000000000000', 'Tuz',              'Tuz',              '["tuz","salt","deniz tuzu","kaya tuzu"]'::jsonb,                                                               true, false, false),
('ee000035-0000-0000-0000-000000000000', 'Karabiber',        'Karabiber',        '["karabiber","black pepper","pepper","taze çekilmiş karabiber"]'::jsonb,                                       true, false, false),
('ee000036-0000-0000-0000-000000000000', 'Kimyon',           'Kimyon',           '["kimyon","cumin","öğütülmüş kimyon"]'::jsonb,                                                                 true, false, false),
('ee000037-0000-0000-0000-000000000000', 'Kırmızı Pul Biber','Kırmızı Pul Biber','["kırmızı pul biber","pul biber","red pepper flakes","chili flakes","acı pul biber"]'::jsonb,         true, false, false)

ON CONFLICT ("Id") DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- B) INGREDIENT FAMILIES (8 aile)
-- ════════════════════════════════════════════════════════════

INSERT INTO "IngredientFamilies" ("Id", "Name", "Description", "IsActive", "SortOrder", "CreatedAtUtc", "UpdatedAtUtc") VALUES
('ff000001-0000-0000-0000-000000000000', 'Süt Ürünleri',        'Fermente ve taze süt ürünleri',            true, 1, NOW(), NOW()),
('ff000002-0000-0000-0000-000000000000', 'Peynirler',            'Olgunlaştırılmış ve taze peynirler',        true, 2, NOW(), NOW()),
('ff000003-0000-0000-0000-000000000000', 'Yapraklı Sebzeler',    'Yeşil yapraklı sebze grubu',               true, 3, NOW(), NOW()),
('ff000004-0000-0000-0000-000000000000', 'Meyvemsi Sebzeler',   'Meyve botanik sınıfında olan sebzeler',    true, 4, NOW(), NOW()),
('ff000005-0000-0000-0000-000000000000', 'Tahıllar',             'Tam tahıl ve işlenmiş tahıl grubu',        true, 5, NOW(), NOW()),
('ff000006-0000-0000-0000-000000000000', 'Makarnamsılar',        'Hamur bazlı tahıl ürünleri',               true, 6, NOW(), NOW()),
('ff000007-0000-0000-0000-000000000000', 'Kümes ve Kırmızı Et', 'Kanatlı ve kırmızı et protein grubu',      true, 7, NOW(), NOW()),
('ff000008-0000-0000-0000-000000000000', 'Deniz Ürünleri',       'Balık ve deniz ürünleri protein grubu',    true, 8, NOW(), NOW())
ON CONFLICT ("Id") DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- C) INGREDIENT FAMILY MEMBERS
-- Role: 'Base' | 'Variant' | 'Derived'
-- ════════════════════════════════════════════════════════════

INSERT INTO "IngredientFamilyMembers" ("FamilyId", "IngredientId", "Role") VALUES
-- f01: Süt Ürünleri
('ff000001-0000-0000-0000-000000000000', 'ee000001-0000-0000-0000-000000000000', 'Base'),     -- Yoğurt
('ff000001-0000-0000-0000-000000000000', 'ee000002-0000-0000-0000-000000000000', 'Variant'),  -- Süzme Yoğurt
('ff000001-0000-0000-0000-000000000000', 'ee000003-0000-0000-0000-000000000000', 'Variant'),  -- Kefir
('ff000001-0000-0000-0000-000000000000', 'ee000004-0000-0000-0000-000000000000', 'Base'),     -- Süt
('ff000001-0000-0000-0000-000000000000', 'ee000005-0000-0000-0000-000000000000', 'Derived'),  -- Lor Peyniri

-- f02: Peynirler
('ff000002-0000-0000-0000-000000000000', 'ee000006-0000-0000-0000-000000000000', 'Base'),     -- Beyaz Peynir
('ff000002-0000-0000-0000-000000000000', 'ee000007-0000-0000-0000-000000000000', 'Variant'),  -- Kaşar Peyniri
('ff000002-0000-0000-0000-000000000000', 'ee000008-0000-0000-0000-000000000000', 'Variant'),  -- Tulum Peyniri

-- f03: Yapraklı Sebzeler
('ff000003-0000-0000-0000-000000000000', 'ee000010-0000-0000-0000-000000000000', 'Base'),     -- Ispanak
('ff000003-0000-0000-0000-000000000000', 'ee000015-0000-0000-0000-000000000000', 'Base'),     -- Marul
('ff000003-0000-0000-0000-000000000000', 'ee000016-0000-0000-0000-000000000000', 'Variant'),  -- Roka

-- f04: Meyvemsi Sebzeler
('ff000004-0000-0000-0000-000000000000', 'ee00000b-0000-0000-0000-000000000000', 'Base'),     -- Domates
('ff000004-0000-0000-0000-000000000000', 'ee00000d-0000-0000-0000-000000000000', 'Base'),     -- Biber
('ff000004-0000-0000-0000-000000000000', 'ee000013-0000-0000-0000-000000000000', 'Variant'),  -- Patlıcan
('ff000004-0000-0000-0000-000000000000', 'ee000014-0000-0000-0000-000000000000', 'Variant'),  -- Kabak

-- f05: Tahıllar
('ff000005-0000-0000-0000-000000000000', 'ee000027-0000-0000-0000-000000000000', 'Base'),     -- Yulaf
('ff000005-0000-0000-0000-000000000000', 'ee000028-0000-0000-0000-000000000000', 'Base'),     -- Pirinç
('ff000005-0000-0000-0000-000000000000', 'ee000029-0000-0000-0000-000000000000', 'Variant'),  -- Bulgur
('ff000005-0000-0000-0000-000000000000', 'ee00002b-0000-0000-0000-000000000000', 'Variant'),  -- Kinoa

-- f06: Makarnamsılar
('ff000006-0000-0000-0000-000000000000', 'ee00002a-0000-0000-0000-000000000000', 'Base'),     -- Makarna

-- f07: Kümes ve Kırmızı Et
('ff000007-0000-0000-0000-000000000000', 'ee000022-0000-0000-0000-000000000000', 'Base'),     -- Tavuk Göğsü
('ff000007-0000-0000-0000-000000000000', 'ee000026-0000-0000-0000-000000000000', 'Variant'),  -- Hindi Göğsü
('ff000007-0000-0000-0000-000000000000', 'ee000024-0000-0000-0000-000000000000', 'Variant'),  -- Kıyma

-- f08: Deniz Ürünleri
('ff000008-0000-0000-0000-000000000000', 'ee000023-0000-0000-0000-000000000000', 'Base'),     -- Ton Balığı
('ff000008-0000-0000-0000-000000000000', 'ee000025-0000-0000-0000-000000000000', 'Variant')   -- Somon

ON CONFLICT ("FamilyId", "IngredientId") DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- D) INGREDIENT COMPATIBILITY RULES (17 kural)
-- CompatibilityType: 'SubstituteAllowed' | 'FamilyCompatible' | 'ExactOnly' | 'NotCompatible'
-- RequiredIngredient → CandidateIngredient (yön önemli; ayrı satır = çift yönlü)
-- ════════════════════════════════════════════════════════════

INSERT INTO "IngredientCompatibilityRules"
  ("Id", "RequiredIngredientId", "CandidateIngredientId", "CompatibilityType", "ScorePenalty", "Reason", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
VALUES
-- Yoğurt ↔ Kefir
('ca000001-0000-0000-0000-000000000000',
 'ee000001-0000-0000-0000-000000000000', 'ee000003-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Süt bazlı fermente ürün olarak ikame edilebilir', true, NOW(), NOW()),

-- Yoğurt → Süzme Yoğurt
('ca000002-0000-0000-0000-000000000000',
 'ee000001-0000-0000-0000-000000000000', 'ee000002-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.05, 'Süzme yoğurt yoğurdun direkt ikamesidir', true, NOW(), NOW()),

-- Süzme Yoğurt → Yoğurt
('ca000003-0000-0000-0000-000000000000',
 'ee000002-0000-0000-0000-000000000000', 'ee000001-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.05, 'Yoğurt ile ikame edilebilir', true, NOW(), NOW()),

-- Pirinç → Bulgur
('ca000004-0000-0000-0000-000000000000',
 'ee000028-0000-0000-0000-000000000000', 'ee000029-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Tahıl grubunda ikame — benzer pişirme süresi', true, NOW(), NOW()),

-- Pirinç → Kinoa
('ca000005-0000-0000-0000-000000000000',
 'ee000028-0000-0000-0000-000000000000', 'ee00002b-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.15, 'Protein açısından daha zengin tahıl ikamesi', true, NOW(), NOW()),

-- Bulgur → Pirinç
('ca000006-0000-0000-0000-000000000000',
 'ee000029-0000-0000-0000-000000000000', 'ee000028-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Tahıl grubunda ikame', true, NOW(), NOW()),

-- Makarna → Bulgur
('ca000007-0000-0000-0000-000000000000',
 'ee00002a-0000-0000-0000-000000000000', 'ee000029-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.20, 'Tahıl grubunda kısmi ikame — doku farklılığı var', true, NOW(), NOW()),

-- Tavuk Göğsü → Hindi Göğsü
('ca000008-0000-0000-0000-000000000000',
 'ee000022-0000-0000-0000-000000000000', 'ee000026-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.05, 'Kümes hayvanı proteini olarak ikame edilebilir', true, NOW(), NOW()),

-- Ton Balığı → Somon
('ca000009-0000-0000-0000-000000000000',
 'ee000023-0000-0000-0000-000000000000', 'ee000025-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Balık proteini olarak ikame edilebilir', true, NOW(), NOW()),

-- Somon → Ton Balığı
('ca00000a-0000-0000-0000-000000000000',
 'ee000025-0000-0000-0000-000000000000', 'ee000023-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Balık proteini olarak ikame edilebilir', true, NOW(), NOW()),

-- Ispanak → Roka
('ca00000b-0000-0000-0000-000000000000',
 'ee000010-0000-0000-0000-000000000000', 'ee000016-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.15, 'Yapraklı yeşil sebze olarak ikame — tat farklılığı var', true, NOW(), NOW()),

-- Roka → Marul
('ca00000c-0000-0000-0000-000000000000',
 'ee000016-0000-0000-0000-000000000000', 'ee000015-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Yapraklı yeşil sebze olarak ikame', true, NOW(), NOW()),

-- Beyaz Peynir → Lor Peyniri
('ca00000d-0000-0000-0000-000000000000',
 'ee000006-0000-0000-0000-000000000000', 'ee000005-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Taze peynir ailesi ikamesi — benzer protein içeriği', true, NOW(), NOW()),

-- Lor Peyniri → Beyaz Peynir
('ca00000e-0000-0000-0000-000000000000',
 'ee000005-0000-0000-0000-000000000000', 'ee000006-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.10, 'Taze peynir ailesi ikamesi', true, NOW(), NOW()),

-- Zeytinyağı → Tereyağı (kısmi)
('ca00000f-0000-0000-0000-000000000000',
 'ee000031-0000-0000-0000-000000000000', 'ee000009-0000-0000-0000-000000000000',
 'SubstituteAllowed', 0.25, 'Yağ kaynağı olarak kısmi ikame — farklı besin profili', true, NOW(), NOW()),

-- Domates → Biber (aile uyumlu)
('ca000010-0000-0000-0000-000000000000',
 'ee00000b-0000-0000-0000-000000000000', 'ee00000d-0000-0000-0000-000000000000',
 'FamilyCompatible', 0.20, 'Meyvemsi sebze ailesi — kısmi tat uyumu', true, NOW(), NOW()),

-- Kırmızı Mercimek → Nohut (aile uyumlu)
('ca000011-0000-0000-0000-000000000000',
 'ee00002e-0000-0000-0000-000000000000', 'ee00002f-0000-0000-0000-000000000000',
 'FamilyCompatible', 0.15, 'Baklagil ailesi alternatifleri — pişirme süresi farklı', true, NOW(), NOW())

ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- ÖZET
-- ============================================================
-- Eklenen kayıtlar:
--   Ingredients           : 55 adet
--   IngredientFamilies    :  8 adet
--   IngredientFamilyMembers: 25 adet
--   CompatibilityRules    : 17 adet
--
-- UUID Hızlı Referans (Part 2+ için):
--   Yoğurt          : ee000001-...
--   Süzme Yoğurt    : ee000002-...
--   Kefir           : ee000003-...
--   Süt             : ee000004-...
--   Lor Peyniri     : ee000005-...
--   Beyaz Peynir    : ee000006-...
--   Kaşar Peyniri  : ee000007-...
--   Tulum Peyniri   : ee000008-...
--   Tereyağı       : ee000009-...
--   Krema           : ee00000a-...
--   Domates         : ee00000b-...
--   Salatalık      : ee00000c-...
--   Biber           : ee00000d-...
--   Soğan          : ee00000e-...
--   Sarımsak       : ee00000f-...
--   Ispanak         : ee000010-...
--   Brokoli         : ee000011-...
--   Havuç          : ee000012-...
--   Patlıcan       : ee000013-...
--   Kabak           : ee000014-...
--   Marul           : ee000015-...
--   Roka            : ee000016-...
--   Maydanoz        : ee000017-...
--   Dereotu         : ee000018-...
--   Nane            : ee000019-...
--   Muz             : ee00001a-...
--   Elma            : ee00001b-...
--   Portakal        : ee00001c-...
--   Çilek          : ee00001d-...
--   Avokado         : ee00001e-...
--   Limon           : ee00001f-...
--   Kivi            : ee000020-...
--   Yumurta         : ee000021-...
--   Tavuk Göğsü   : ee000022-...
--   Ton Balığı     : ee000023-...
--   Kıyma          : ee000024-...
--   Somon           : ee000025-...
--   Hindi Göğsü   : ee000026-...
--   Yulaf           : ee000027-...
--   Pirinç         : ee000028-...
--   Bulgur          : ee000029-...
--   Makarna         : ee00002a-...
--   Kinoa           : ee00002b-...
--   Ekmek           : ee00002c-...
--   Un              : ee00002d-...
--   Kırmızı Mercimek: ee00002e-...
--   Nohut           : ee00002f-...
--   Kuru Fasulye    : ee000030-...
--   Zeytinyağı     : ee000031-...
--   Zeytin          : ee000032-...
--   Bal             : ee000033-...
--   Tuz             : ee000034-...
--   Karabiber       : ee000035-...
--   Kimyon          : ee000036-...
--   Kırmızı Pul Biber: ee000037-...
-- ============================================================
