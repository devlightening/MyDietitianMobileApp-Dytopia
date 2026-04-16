-- ============================================================
-- PART 2: Kullanıcılar — Diyetisyenler ve Danışanlar
-- ============================================================
-- ÇALIŞTIRMA SIRASI:
--   1. Önce AuthDb bağlantısında "=== AUTHDB ===" bloğunu çalıştır
--   2. Sonra AppDb bağlantısında "=== APPDB ===" bloğunu çalıştır
--
-- Şifre Hash Yöntemi: ASP.NET Core Identity V3 (PBKDF2-SHA1, 10000 iter)
--   Aynı yöntem: PasswordHasher<T>.HashPassword() — DatabaseSeeder ile uyumlu
--
-- UUID Referans:
--   Dietitians (AppDb) : dd000001-... (d01) ... dd00000a-... (d10)
--   Clients (AppDb)    : cc000001-... (c01) ... cc00000c-... (c12)
--   UserAccounts (Auth): aa000001-... (d01) ... aa00000a-... (d10)  [diyetisyenler]
--                        ab000001-... (c01) ... ab00000c-... (c12)  [danışanlar]
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BÖLÜM 1/2: AuthDb
-- Bağlantı: ConnectionStrings__AuthDb veritabanında çalıştır
-- ════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO "UserAccounts"
  ("Id", "Email", "PasswordHash", "Role", "FullName",
   "LinkedDietitianId", "LinkedClientId", "ActiveDietitianContextId", "PublicUserId", "SecurityStamp")
VALUES

-- ─── Diyetisyenler (Role = 'Dietitian') ───────────────────

('aa000001-0000-0000-0000-000000000000',
 'diyetisyen01@gmail.com',
 'AQAAAAEAACcQAAAAEOSBdBUww4eVV0tt7fVdcUKZxr442O6PAAG21XZ4mERHDP5x9ULvMuQ4WJmqNvBB2Q==',
 'Dietitian', 'Ahmet Kaya',
 'dd000001-0000-0000-0000-000000000000', NULL, NULL, 'DT-0001-2026-01', md5('aa000001-0000-0000-0000-000000000000')),

('aa000002-0000-0000-0000-000000000000',
 'diyetisyen02@gmail.com',
 'AQAAAAEAACcQAAAAEIT7axjLpI6CjY8FwbBalT+/6HYXZK1BjidPI6hHYqsXrHpWLA2o0J6qJMOakySw5g==',
 'Dietitian', 'Elif Demir',
 'dd000002-0000-0000-0000-000000000000', NULL, NULL, 'DT-0002-2026-02', md5('aa000002-0000-0000-0000-000000000000')),

('aa000003-0000-0000-0000-000000000000',
 'diyetisyen03@gmail.com',
 'AQAAAAEAACcQAAAAEElj24X3+nks/LjANmO5SXahz5fhzLa/Q5p6kzL54coM4iqCTGKSmY/cAoAiUCKbPQ==',
 'Dietitian', 'Mehmet Yılmaz',
 'dd000003-0000-0000-0000-000000000000', NULL, NULL, 'DT-0003-2026-03', md5('aa000003-0000-0000-0000-000000000000')),

('aa000004-0000-0000-0000-000000000000',
 'diyetisyen04@gmail.com',
 'AQAAAAEAACcQAAAAEHzBCNaPszeBQ4g+W9noxnhYLA6onZBHH02+fI8o6b/B5WVZebxv6DL3sH1bTHBS2A==',
 'Dietitian', 'Zeynep Çelik',
 'dd000004-0000-0000-0000-000000000000', NULL, NULL, 'DT-0004-2026-04', md5('aa000004-0000-0000-0000-000000000000')),

('aa000005-0000-0000-0000-000000000000',
 'diyetisyen05@gmail.com',
 'AQAAAAEAACcQAAAAEEEP8Sb9rkTCl0wSz1hBca1RFD1YukWD+eBQGGD3DWdKaX1SE7FuGt+DZYOjQe2LKA==',
 'Dietitian', 'Fatma Şahin',
 'dd000005-0000-0000-0000-000000000000', NULL, NULL, 'DT-0005-2026-05', md5('aa000005-0000-0000-0000-000000000000')),

('aa000006-0000-0000-0000-000000000000',
 'diyetisyen06@gmail.com',
 'AQAAAAEAACcQAAAAEA+hGTWEMiz4MTHnojyaBxtDQiih5jtFd0lyiW7gjQea7QQYONuiwersOLPRgwmNVA==',
 'Dietitian', 'Ali Öztürk',
 'dd000006-0000-0000-0000-000000000000', NULL, NULL, 'DT-0006-2026-06', md5('aa000006-0000-0000-0000-000000000000')),

('aa000007-0000-0000-0000-000000000000',
 'diyetisyen07@gmail.com',
 'AQAAAAEAACcQAAAAEBn5cBqab4V8YPmFZElbwZJmvokuKDajjiNzeESQcX6134kXWcZiQZLu5eyFrkUBUg==',
 'Dietitian', 'Ayşe Arslan',
 'dd000007-0000-0000-0000-000000000000', NULL, NULL, 'DT-0007-2026-07', md5('aa000007-0000-0000-0000-000000000000')),

('aa000008-0000-0000-0000-000000000000',
 'diyetisyen08@gmail.com',
 'AQAAAAEAACcQAAAAEAg4ojMeFcIrcAesmKrqHkZGfvdWYizP0AQ7k3x0vJVfVcSur/OApZs9Ogfg8jQ6ig==',
 'Dietitian', 'Mustafa Koç',
 'dd000008-0000-0000-0000-000000000000', NULL, NULL, 'DT-0008-2026-08', md5('aa000008-0000-0000-0000-000000000000')),

('aa000009-0000-0000-0000-000000000000',
 'diyetisyen09@gmail.com',
 'AQAAAAEAACcQAAAAEMDKwGcMK5e3HQXQsQ4t1owZXUPHMHmm/dn2Z31ubNifwiHmlOHb3n5PbnB7VOWYag==',
 'Dietitian', 'Selin Aydın',
 'dd000009-0000-0000-0000-000000000000', NULL, NULL, 'DT-0009-2026-09', md5('aa000009-0000-0000-0000-000000000000')),

('aa00000a-0000-0000-0000-000000000000',
 'diyetisyen10@gmail.com',
 'AQAAAAEAACcQAAAAEG+kel+HSCOrIGD/3bllOswcjSelrZqg/YNoNjIaWnK0hL7LIUFAukz1SfJ5Ga85Zw==',
 'Dietitian', 'Burak Yıldız',
 'dd00000a-0000-0000-0000-000000000000', NULL, NULL, 'DT-0010-2026-10', md5('aa00000a-0000-0000-0000-000000000000')),

-- ─── Danışanlar (Role = 'Client') ─────────────────────────
-- Premium (c01-c10): ActiveDietitianContextId = kendi diyetisyeninin AppDb UUID'si

('ab000001-0000-0000-0000-000000000000',
 'clienttest01@gmail.com',
 'AQAAAAEAACcQAAAAEHYCviVlQkRCnZL6YERqdC5z0OYI/0BESt7rvkl96abVqgKUSWwgMYepCV2KeWq4mQ==',
 'Client', 'Mert Kaya',
 NULL, 'cc000001-0000-0000-0000-000000000000', 'dd000001-0000-0000-0000-000000000000', 'CL-0001-2026-01', md5('ab000001-0000-0000-0000-000000000000')),

('ab000002-0000-0000-0000-000000000000',
 'clienttest02@gmail.com',
 'AQAAAAEAACcQAAAAEPUTnkClwFR5deGp4tCfGX38VrHBOOf9OXbg3nAwsdAWDNIddPoqyf+gs77EJac9pA==',
 'Client', 'Deniz Demir',
 NULL, 'cc000002-0000-0000-0000-000000000000', 'dd000002-0000-0000-0000-000000000000', 'CL-0002-2026-02', md5('ab000002-0000-0000-0000-000000000000')),

('ab000003-0000-0000-0000-000000000000',
 'clienttest03@gmail.com',
 'AQAAAAEAACcQAAAAEA4YpyEa5Pnd/FDrTivilDAVMSR4hIhQ3/Izl2Xx2OL00xeZW8NrXOGZQmaWqCeBMA==',
 'Client', 'Ece Yılmaz',
 NULL, 'cc000003-0000-0000-0000-000000000000', 'dd000003-0000-0000-0000-000000000000', 'CL-0003-2026-03', md5('ab000003-0000-0000-0000-000000000000')),

('ab000004-0000-0000-0000-000000000000',
 'clienttest04@gmail.com',
 'AQAAAAEAACcQAAAAEPZIfn5E2VaLZMbyXgYEpuHpYXZtOuN6ORBIJ1WDsY3pOXs8/AmDES5x6fdqAT2tmQ==',
 'Client', 'Can Çelik',
 NULL, 'cc000004-0000-0000-0000-000000000000', 'dd000004-0000-0000-0000-000000000000', 'CL-0004-2026-04', md5('ab000004-0000-0000-0000-000000000000')),

('ab000005-0000-0000-0000-000000000000',
 'clienttest05@gmail.com',
 'AQAAAAEAACcQAAAAEGIxxQlbjR8BSJ5I3/YOf2H+iYPfFHbDAaMgGVB061Pt/i2EPi0rfrXpLP4D/gipLw==',
 'Client', 'Sude Şahin',
 NULL, 'cc000005-0000-0000-0000-000000000000', 'dd000005-0000-0000-0000-000000000000', 'CL-0005-2026-05', md5('ab000005-0000-0000-0000-000000000000')),

('ab000006-0000-0000-0000-000000000000',
 'clienttest06@gmail.com',
 'AQAAAAEAACcQAAAAEHLjvgWId7pg5/B7mXhpg6pMpifMIb5ahepHPtO0bdeJYfYWWTgUZm2pvPLR8YOrCA==',
 'Client', 'Emre Öztürk',
 NULL, 'cc000006-0000-0000-0000-000000000000', 'dd000006-0000-0000-0000-000000000000', 'CL-0006-2026-06', md5('ab000006-0000-0000-0000-000000000000')),

('ab000007-0000-0000-0000-000000000000',
 'clienttest07@gmail.com',
 'AQAAAAEAACcQAAAAEO731iF7KRkKvVuHu66aw/e/aXT/G8aeqomWgUD4gcn65iXeo8Z1xdTPQqdbH7Z2MA==',
 'Client', 'Beren Arslan',
 NULL, 'cc000007-0000-0000-0000-000000000000', 'dd000007-0000-0000-0000-000000000000', 'CL-0007-2026-07', md5('ab000007-0000-0000-0000-000000000000')),

('ab000008-0000-0000-0000-000000000000',
 'clienttest08@gmail.com',
 'AQAAAAEAACcQAAAAEGqoOqw+8MCtIWUjaLmEmgjFGvIHYz20RP3dkUzTbXdQAkIg6QpJfegar+7FtQH/7g==',
 'Client', 'Kaan Koç',
 NULL, 'cc000008-0000-0000-0000-000000000000', 'dd000008-0000-0000-0000-000000000000', 'CL-0008-2026-08', md5('ab000008-0000-0000-0000-000000000000')),

('ab000009-0000-0000-0000-000000000000',
 'clienttest09@gmail.com',
 'AQAAAAEAACcQAAAAEBaLMQo48F4xxNcUBUSvpUKel5ozJPFHS37Sx7nuBd5pf8u2FctHX9ceVc5DMRWOUA==',
 'Client', 'Defne Aydın',
 NULL, 'cc000009-0000-0000-0000-000000000000', 'dd000009-0000-0000-0000-000000000000', 'CL-0009-2026-09', md5('ab000009-0000-0000-0000-000000000000')),

('ab00000a-0000-0000-0000-000000000000',
 'clienttest10@gmail.com',
 'AQAAAAEAACcQAAAAEETKNAQj/uyxDlh/0VdIIRE1SbRKl5B0CQfRcCov5v++3vNOLq4tSrFr0OEvrdQbSQ==',
 'Client', 'Yiğit Yıldız',
 NULL, 'cc00000a-0000-0000-0000-000000000000', 'dd00000a-0000-0000-0000-000000000000', 'CL-0010-2026-10', md5('ab00000a-0000-0000-0000-000000000000')),

-- Free danışanlar (c11-c12): ActiveDietitianContextId = NULL
('ab00000b-0000-0000-0000-000000000000',
 'clienttest11@gmail.com',
 'AQAAAAEAACcQAAAAECOD+QIxJMgGIZTrCCUt2Xnnfj5ABKG3JtYqTPL97bJhkaYHZvkEDI9qjtE0crtL4Q==',
 'Client', 'Lara Özgür',
 NULL, 'cc00000b-0000-0000-0000-000000000000', NULL, 'CL-0011-2026-11', md5('ab00000b-0000-0000-0000-000000000000')),

('ab00000c-0000-0000-0000-000000000000',
 'clienttest12@gmail.com',
 'AQAAAAEAACcQAAAAEHin2grH3F+i5JJOUjHeqhkBqn9Rlhpi29viy1fNOzmWDIhz2YZg6M2Q71u1O+YjTQ==',
 'Client', 'Toprak Güneş',
 NULL, 'cc00000c-0000-0000-0000-000000000000', NULL, 'CL-0012-2026-12', md5('ab00000c-0000-0000-0000-000000000000'))

ON CONFLICT ("Id") DO NOTHING;

COMMIT;


-- ════════════════════════════════════════════════════════════
-- BÖLÜM 2/2: AppDb
-- Bağlantı: ConnectionStrings__AppDb veritabanında çalıştır
-- ════════════════════════════════════════════════════════════

BEGIN;

-- ─── A) DİYETİSYENLER ─────────────────────────────────────

INSERT INTO "Dietitians" ("Id", "FullName", "ClinicName", "IsActive") VALUES
('dd000001-0000-0000-0000-000000000000', 'Ahmet Kaya',    'Kaya Beslenme Kliniği',          true),
('dd000002-0000-0000-0000-000000000000', 'Elif Demir',    'Demir Diyet Merkezi',            true),
('dd000003-0000-0000-0000-000000000000', 'Mehmet Yılmaz', 'Yılmaz Sağlıklı Yaşam',         true),
('dd000004-0000-0000-0000-000000000000', 'Zeynep Çelik',  'Çelik Beslenme Danışmanlığı',   true),
('dd000005-0000-0000-0000-000000000000', 'Fatma Şahin',   'Şahin Diyet Kliniği',           true),
('dd000006-0000-0000-0000-000000000000', 'Ali Öztürk',    'Öztürk Wellness',               true),
('dd000007-0000-0000-0000-000000000000', 'Ayşe Arslan',   'Arslan Beslenme',               true),
('dd000008-0000-0000-0000-000000000000', 'Mustafa Koç',   'Koç Diyet Stüdyo',             true),
('dd000009-0000-0000-0000-000000000000', 'Selin Aydın',   'Aydın Sağlık Merkezi',         true),
('dd00000a-0000-0000-0000-000000000000', 'Burak Yıldız',  'Yıldız Klinik',               true)
ON CONFLICT ("Id") DO NOTHING;

-- ─── B) DANIŞANLAR ────────────────────────────────────────
-- Sütunlar: Id, FullName, Email, Gender (0=Male,1=Female), BirthDate,
--           CreatedAt, ActiveDietitianId, PremiumActivatedAt,
--           ProgramStartDate, ProgramEndDate, IsActive, DietitianId (shadow FK, NULL)

INSERT INTO "Clients"
  ("Id", "FullName", "Email", "Gender", "BirthDate", "CreatedAt",
   "ActiveDietitianId", "PremiumActivatedAt",
   "ProgramStartDate", "ProgramEndDate", "IsActive", "DietitianId")
VALUES

-- Premium danışanlar (c01-c10) ─────────────────────────────
('cc000001-0000-0000-0000-000000000000',
 'Mert Kaya',     'clienttest01@gmail.com', 0, '1995-05-15'::date,
 '2026-01-15 08:00:00+00'::timestamptz,
 'dd000001-0000-0000-0000-000000000000',
 '2026-01-15 08:00:00+00'::timestamptz,
 '2026-01-15 00:00:00+00'::timestamptz,
 '2026-04-15 00:00:00+00'::timestamptz,
 true, NULL),

('cc000002-0000-0000-0000-000000000000',
 'Deniz Demir',   'clienttest02@gmail.com', 1, '1992-08-22'::date,
 '2026-01-20 09:00:00+00'::timestamptz,
 'dd000002-0000-0000-0000-000000000000',
 '2026-01-20 09:00:00+00'::timestamptz,
 '2026-01-20 00:00:00+00'::timestamptz,
 '2026-04-20 00:00:00+00'::timestamptz,
 true, NULL),

('cc000003-0000-0000-0000-000000000000',
 'Ece Yılmaz',    'clienttest03@gmail.com', 1, '1998-03-10'::date,
 '2026-02-01 10:00:00+00'::timestamptz,
 'dd000003-0000-0000-0000-000000000000',
 '2026-02-01 10:00:00+00'::timestamptz,
 '2026-02-01 00:00:00+00'::timestamptz,
 '2026-05-01 00:00:00+00'::timestamptz,
 true, NULL),

('cc000004-0000-0000-0000-000000000000',
 'Can Çelik',     'clienttest04@gmail.com', 0, '1990-11-30'::date,
 '2026-02-05 11:00:00+00'::timestamptz,
 'dd000004-0000-0000-0000-000000000000',
 '2026-02-05 11:00:00+00'::timestamptz,
 '2026-02-05 00:00:00+00'::timestamptz,
 '2026-05-05 00:00:00+00'::timestamptz,
 true, NULL),

('cc000005-0000-0000-0000-000000000000',
 'Sude Şahin',    'clienttest05@gmail.com', 1, '2000-07-18'::date,
 '2026-01-10 07:30:00+00'::timestamptz,
 'dd000005-0000-0000-0000-000000000000',
 '2026-01-10 07:30:00+00'::timestamptz,
 '2026-01-10 00:00:00+00'::timestamptz,
 '2026-04-10 00:00:00+00'::timestamptz,
 true, NULL),

('cc000006-0000-0000-0000-000000000000',
 'Emre Öztürk',   'clienttest06@gmail.com', 0, '1988-01-25'::date,
 '2026-02-10 08:45:00+00'::timestamptz,
 'dd000006-0000-0000-0000-000000000000',
 '2026-02-10 08:45:00+00'::timestamptz,
 '2026-02-10 00:00:00+00'::timestamptz,
 '2026-05-10 00:00:00+00'::timestamptz,
 true, NULL),

('cc000007-0000-0000-0000-000000000000',
 'Beren Arslan',  'clienttest07@gmail.com', 1, '1996-09-05'::date,
 '2026-01-25 09:15:00+00'::timestamptz,
 'dd000007-0000-0000-0000-000000000000',
 '2026-01-25 09:15:00+00'::timestamptz,
 '2026-01-25 00:00:00+00'::timestamptz,
 '2026-04-25 00:00:00+00'::timestamptz,
 true, NULL),

('cc000008-0000-0000-0000-000000000000',
 'Kaan Koç',      'clienttest08@gmail.com', 0, '1993-12-20'::date,
 '2026-02-15 10:30:00+00'::timestamptz,
 'dd000008-0000-0000-0000-000000000000',
 '2026-02-15 10:30:00+00'::timestamptz,
 '2026-02-15 00:00:00+00'::timestamptz,
 '2026-05-15 00:00:00+00'::timestamptz,
 true, NULL),

('cc000009-0000-0000-0000-000000000000',
 'Defne Aydın',   'clienttest09@gmail.com', 1, '1997-04-14'::date,
 '2026-01-05 08:00:00+00'::timestamptz,
 'dd000009-0000-0000-0000-000000000000',
 '2026-01-05 08:00:00+00'::timestamptz,
 '2026-01-05 00:00:00+00'::timestamptz,
 '2026-04-05 00:00:00+00'::timestamptz,
 true, NULL),

('cc00000a-0000-0000-0000-000000000000',
 'Yiğit Yıldız',  'clienttest10@gmail.com', 0, '1991-06-28'::date,
 '2026-02-20 11:00:00+00'::timestamptz,
 'dd00000a-0000-0000-0000-000000000000',
 '2026-02-20 11:00:00+00'::timestamptz,
 '2026-02-20 00:00:00+00'::timestamptz,
 '2026-05-20 00:00:00+00'::timestamptz,
 true, NULL),

-- Free danışanlar (c11-c12) ────────────────────────────────
('cc00000b-0000-0000-0000-000000000000',
 'Lara Özgür',    'clienttest11@gmail.com', 1, '2001-02-09'::date,
 '2026-03-01 12:00:00+00'::timestamptz,
 NULL, NULL, NULL, NULL,
 true, NULL),

('cc00000c-0000-0000-0000-000000000000',
 'Toprak Güneş',  'clienttest12@gmail.com', 0, '1999-10-17'::date,
 '2026-03-05 14:00:00+00'::timestamptz,
 NULL, NULL, NULL, NULL,
 true, NULL)

ON CONFLICT ("Id") DO NOTHING;

COMMIT;

-- ============================================================
-- ÖZET
-- ============================================================
-- AuthDb — UserAccounts: 22 kayıt (10 Diyetisyen + 12 Danışan)
-- AppDb  — Dietitians  : 10 kayıt
-- AppDb  — Clients     : 12 kayıt (10 Premium + 2 Free)
--
-- Hızlı Referans — Dietitian UUID'leri:
--   d01 Ahmet Kaya     : dd000001-0000-0000-0000-000000000000
--   d02 Elif Demir     : dd000002-0000-0000-0000-000000000000
--   d03 Mehmet Yılmaz  : dd000003-0000-0000-0000-000000000000
--   d04 Zeynep Çelik   : dd000004-0000-0000-0000-000000000000
--   d05 Fatma Şahin    : dd000005-0000-0000-0000-000000000000
--   d06 Ali Öztürk     : dd000006-0000-0000-0000-000000000000
--   d07 Ayşe Arslan    : dd000007-0000-0000-0000-000000000000
--   d08 Mustafa Koç    : dd000008-0000-0000-0000-000000000000
--   d09 Selin Aydın    : dd000009-0000-0000-0000-000000000000
--   d10 Burak Yıldız   : dd00000a-0000-0000-0000-000000000000
--
-- Hızlı Referans — Client UUID'leri:
--   c01 Mert Kaya      : cc000001-0000-0000-0000-000000000000  [PREMIUM → d01]
--   c02 Deniz Demir    : cc000002-0000-0000-0000-000000000000  [PREMIUM → d02]
--   c03 Ece Yılmaz     : cc000003-0000-0000-0000-000000000000  [PREMIUM → d03]
--   c04 Can Çelik      : cc000004-0000-0000-0000-000000000000  [PREMIUM → d04]
--   c05 Sude Şahin     : cc000005-0000-0000-0000-000000000000  [PREMIUM → d05]
--   c06 Emre Öztürk    : cc000006-0000-0000-0000-000000000000  [PREMIUM → d06]
--   c07 Beren Arslan   : cc000007-0000-0000-0000-000000000000  [PREMIUM → d07]
--   c08 Kaan Koç       : cc000008-0000-0000-0000-000000000000  [PREMIUM → d08]
--   c09 Defne Aydın    : cc000009-0000-0000-0000-000000000000  [PREMIUM → d09]
--   c10 Yiğit Yıldız   : cc00000a-0000-0000-0000-000000000000  [PREMIUM → d10]
--   c11 Lara Özgür     : cc00000b-0000-0000-0000-000000000000  [FREE]
--   c12 Toprak Güneş   : cc00000c-0000-0000-0000-000000000000  [FREE]
-- ============================================================
