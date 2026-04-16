# MyDietitianMobileApp — PROJE BİTİRME MASTER PROMPT'U
# Çok Katmanlı Malzeme Standardizasyonu ve Kural Tabanlı Tarif Öneri Sistemi

> **Bu prompt'u Claude Code'a verin.**
> Bu, projenin tamamını — backend doğrulaması, web panel, mobil uygulama ve tez sunumuna hazırlık — kapsamlı şekilde bitirmek için hazırlanmış master rehberdir.
> **Her değişiklikten önce mevcut kodu oku, anla, sonra en küçük doğru adımı at.**

---

## ════════════════════════════════════════
## BÖLÜM A — TEZ BAĞLAMI VE AKADEMİK ÇERÇEVESİ
## ════════════════════════════════════════

### A.1. Tez Kimliği

- **Tez Başlığı:** "Diyetisyen Destekli Mobil Beslenme Uygulamaları İçin Çok Katmanlı Malzeme Standardizasyonu ve Kural Tabanlı Tarif Öneri Sistemi"
- **Öğrenci:** Halil İbrahim Yıldırım — 212503009
- **Bölüm:** Bilgisayar Mühendisliği
- **Ders:** Computer Engineering Design / Bitirme Projesi (2026)

### A.2. Tezin Teknik Problemi

Bu bir **uygulama geliştirme projesi değildir.** Bu bir **bilgisayar mühendisliği problemidir:**

**Problem:** Kullanıcılar aynı malzemeyi çok farklı şekillerde yazabilmektedir:
- "süzme yogurt", "suzme yogurt", "yoğurt", "meyveli yoğurt", "light ton"
- Bu girdiler doğrudan veritabanındaki standart isimlerle eşleşmez
- Bu durum tarif eşleştirme motorunun başarısını düşürür

**Çözüm — 4 Teknik Pillar:**

1. **Çok Katmanlı Normalizasyon (Multi-Layer Matching)**
   - Katman 1: Exact Canonical Match — birebir eşleşme
   - Katman 2: Alias Match — bilinen alternatif yazımlar/eşanlamlılar
   - Katman 3: Fuzzy Match — yazım hataları, Türkçe karakter farkları
   - Katman 4: LLM Fallback — önceki katmanlar başarısız olduğunda anlamsal yorumlama

2. **Ingredient Taxonomy (Malzeme Taksonomisi)**
   - Malzeme aileleri (families)
   - Aile üyeleri (members)
   - Varyantlar
   - Uyumluluk kuralları (compatibility rules)
   - Örnek: "Yoğurt" ana malzeme → "Süzme Yoğurt" varyant → "Kefir" alternatif

3. **Kural Tabanlı Tarif Öneri Motoru**
   - Zorunlu malzemeler → Eksikse tarif reddedilir
   - Opsiyonel malzemeler → Yoksa tarif kabul edilir, puan düşer
   - Yasaklı malzemeler → Varsa tarif engellenir
   - Alternatif malzemeler → Uyumluluk kuralına göre değerlendirilir

4. **Ölçüm ve Benchmark**
   - Normalizasyon logları (hangi katman kullanıldı?)
   - Recommendation logları (hangi tarif neden önerildi?)
   - Benchmark veri kümeleri
   - Katman bazlı başarı metrikleri

### A.3. Tezde Asla Yapılmaması Gereken Hatalar

- ❌ Projeyi "bir mobil uygulama yaptık" olarak sunma — bu bir **yöntem geliştirme çalışması**
- ❌ Öneri motorunu "arama" olarak tanımlama — bu **kural tabanlı değerlendirme ve sıralama**
- ❌ Diyetisyeni "tarif seçen kişi" olarak gösterme — diyetisyen **kuralları belirler**, öneri motoru **karar verir**
- ❌ AI/LLM'i karar verici olarak sunma — AI **hikayeyi anlatır (motivasyon)**, algoritma **kararı verir (güvenlik)**

---

## ════════════════════════════════════════
## BÖLÜM B — PROJE TEKNOLOJİ HARİTASI
## ════════════════════════════════════════

### B.1. Teknoloji Stack

| Katman | Teknoloji | Durum |
|--------|-----------|-------|
| Mobil Uygulama | React Native + Expo | ⚠️ Çalışıyor ama UI amatör |
| Web Panel | Next.js + Tailwind CSS | ✅ Fonksiyonel ve görsel açıdan iyi |
| Backend API | ASP.NET Core Web API | ✅ Frozen, production-ready |
| Mimari | MediatR / CQRS | ✅ Modüler |
| Veri Erişimi | Entity Framework Core | ✅ Stabil |
| Veritabanı | PostgreSQL | ✅ Stabil |
| Auth | JWT tabanlı | ✅ Verified, 7/7 smoke test |
| Akıllı Eşleme | Exact/Alias/Fuzzy/LLM | ✅ Mimari mevcut |
| Taksonomi | Families/Members/Rules | ✅ DB'de tanımlı |
| İzleme | Benchmark + Log tabloları | ✅ Mevcut |

### B.2. Backend Durumu (FROZEN — DOKUNMA)

Backend 2026-02-13 tarihinde freeze edilmiştir:
- ✅ 24 canonical controller (6 redundant silindi)
- ✅ 7/7 smoke test geçiyor
- ✅ Release build 0 error, 0 warning
- ✅ Auth: 401 koruması verified
- ✅ Role matrix: Client/Dietitian ayrımı enforced
- ✅ IDOR protection: Diyetisyenler birbirinin danışanını göremez
- ✅ Premium gating: Free kullanıcı premium endpoint'lere 403 alır

**Canonical API Route'ları:**
- Client Auth: `POST /api/client/register`, `POST /api/client/login`
- Dietitian Auth: `POST /api/auth/dietitian/register`, `POST /api/auth/dietitian/login`
- Client: `/api/client/pantry`, `/api/client/plans/today`, `/api/client/me`, `/api/client/progress/*`
- Dietitian: `/api/dietitian/clients`, `/api/dietitian/clients/{id}`
- Public: `/api/public/recipes`, `/api/recipes/match`
- Ingredients: `/api/ingredients/search`

### B.3. Proje Dosya Yapısı (Beklenen)

```
MyDietitianMobileApp/
├── src/                              # Backend (.NET Core)
│   └── MyDietitianMobileApp.Api/
│       ├── Controllers/              # 24 canonical controller
│       ├── Services/                 # İş kuralları
│       ├── Data/                     # EF Core, migrations
│       └── Models/                   # DTO, entities
├── tests/                            # Smoke tests
│   └── MyDietitianMobileApp.Api.SmokeTests/
├── web-panel/                        # Next.js diyetisyen paneli
│   └── src/
├── mobile-app/                       # React Native / Expo
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── navigation/
│       ├── api/
│       ├── theme/
│       └── hooks/
├── docs/                             # Dokümantasyon
└── scripts/                          # Yardımcı scriptler
```

---

## ════════════════════════════════════════
## BÖLÜM C — BACKEND DOĞRULAMA VE EKSİKLER
## ════════════════════════════════════════

> **Backend frozen ama tez sunumu için bazı şeylerin çalışıyor olduğundan emin olmalısın.**
> Backend kodunu DEĞİŞTİRME. Sadece kontrol et ve raporla.

### C.1. Doğrulama Checklist'i

Her görevden önce aşağıdakileri kontrol et:

- [ ] `dotnet build src/MyDietitianMobileApp.Api/ -c Release` → 0 error
- [ ] `dotnet test tests/MyDietitianMobileApp.Api.SmokeTests/ -c Release` → 7/7 pass
- [ ] Endpoint inventory güncel mi? (`docs/endpoint-inventory.md`)

### C.2. Normalizasyon Pipeline Kontrolü

Tezin kalbi normalizasyon pipeline'ıdır. Şunları kontrol et:

- [ ] Ingredient search endpoint'i çalışıyor mu? (`GET /api/ingredients/search?q=yogurt`)
- [ ] Exact match çalışıyor mu? ("Yoğurt" → ID döner)
- [ ] Alias match çalışıyor mu? ("yogurt" → Yoğurt ID'sine eşleşir)
- [ ] Fuzzy match çalışıyor mu? ("suzme yogrt" → Süzme Yoğurt)
- [ ] Normalizasyon logları yazılıyor mu? (hangi katman kullanıldı)

Eğer bunlardan herhangi biri ÇALIŞMIYORSA, backend'e dokunmadan **bunu RAPORLA** — sonra birlikte çözeriz.

### C.3. Tarif Öneri Motoru Kontrolü

- [ ] Recipe match endpoint'i çalışıyor mu? (`POST /api/recipes/match`)
- [ ] Zorunlu malzeme eksikliğinde tarif düşük sıralanıyor mu?
- [ ] Yasaklı malzeme varsa tarif eleniyor mu?
- [ ] Alternatif malzeme kabul ediliyor mu?
- [ ] Recommendation logları yazılıyor mu?

### C.4. Seed Data Kontrolü

- [ ] Ingredient aileler (families) ve üyeler (members) seed'de tanımlı mı?
- [ ] En az 1 pozitif eşleşme senaryosu var mı? (Örn: Muz + Yoğurt → Smoothie Bowl %100)
- [ ] En az 1 kısmi eşleşme senaryosu var mı?
- [ ] En az 1 yasaklı senaryo var mı?
- [ ] Diyetisyen imza tarifleri (private recipes) seed'de var mı?

### C.5. Benchmark Kontrolü

- [ ] Benchmark runner çalışıyor mu?
- [ ] Log tabloları veri içeriyor mu?
- [ ] Katman bazlı başarı metrikleri çıkartılabiliyor mu?

**Eğer benchmark verisi yetersizse:** Tez sunumunda gösterilecek en az 50 test girdisi içeren bir benchmark dataset hazırla (JSON veya CSV). Bu veri seti şunları içermeli:
- 15 exact match senaryosu
- 15 alias match senaryosu
- 10 fuzzy match senaryosu
- 5 LLM fallback senaryosu
- 5 unmatched/ambiguous senaryo

---

## ════════════════════════════════════════
## BÖLÜM D — WEB PANEL (DİYETİSYEN TARAFI) İNCELEME
## ════════════════════════════════════════

> Web panel fonksiyonel olarak iyi durumda. Ama tez sunumunda gösterilecek. Kritik sorunları düzelt.

### D.1. Web Panel Mevcut Güçlü Yanlar (KORU)

- ✅ Dashboard
- ✅ Danışanlar (Clients) sayfası
- ✅ Access Key yönetimi
- ✅ Tarifler (Recipes) sayfası
- ✅ Recipe Match / Simulation
- ✅ Branding / Settings

### D.2. Web Panel Kontrol Checklist'i

- [ ] `npm run build` veya `pnpm build` hatasız tamamlanıyor mu?
- [ ] Tüm sayfalar 404 vermeden açılıyor mu?
- [ ] Dietitian login/register çalışıyor mu?
- [ ] Tarif oluşturma (malzeme rolleriyle birlikte) çalışıyor mu?
- [ ] Access Key üretimi çalışıyor mu?
- [ ] Danışan listesi görüntüleniyor mu?
- [ ] Recipe match simulation çalışıyor mu?

### D.3. Web Panel İyileştirme Görevleri

Eğer zaman kalırsa (öncelik mobil):

- [ ] Dashboard KPI kartlarına gerçek veri bağla (aktif danışan sayısı, ortalama uyum)
- [ ] Tarif editöründe malzeme rolü seçimini görsel olarak netleştir (Zorunlu 🔵 / Opsiyonel 🟢 / Alternatif 🔄)
- [ ] Ingredient Autocomplete'in Malzeme Sözlüğü'nden (backend) çektiğinden emin ol
- [ ] Recipe match simulation sayfasında normalizasyon katmanlarını göster (hangi katman kullanıldı)
- [ ] Branding ayarlarında logo upload çalışıyor mu kontrol et

---

## ════════════════════════════════════════
## BÖLÜM E — MOBİL UYGULAMA KAPSAMLI YENİDEN TASARIM
## ════════════════════════════════════════

> **Bu bölüm en büyük ve en öncelikli iş parçasıdır.**
> Mobil uygulama çalışıyor ama tasarım amatör seviyede. Dünya standartlarında SaaS kalitesine çıkarılmalı.
> **Referans:** Noom, MyFitnessPal, Lifesum, Yazio, 8fit

### E.1. MEVCUT DURUMUN ANALİZİ — TESPİT EDİLEN SORUNLAR

Aşağıdaki sorunlar ekran görüntülerinden tespit edilmiştir:

#### E.1.1. Genel Tasarım Sorunları
- [ ] **Amatör card tasarımları:** Kartlar düz, derinliksiz, gölgesiz → Subtle shadow, border-radius 16px, iç padding, gradient arka planlar ekle
- [ ] **Tipografi hiyerarşisi yok:** Boyutlar birbirine yakın → Net type scale: H1: 28-32px bold, H2: 22-24px semibold, Body: 16px regular, Caption: 13px
- [ ] **Renk sistemi zayıf:** Dark mode'da her yer aynı koyu mavi-siyah → Katmanlı elevation seviyeleri (surface-0, surface-1, surface-2)
- [ ] **Spacing tutarsız:** Rastgele boşluklar → 8px grid system (4, 8, 12, 16, 24, 32, 48)
- [ ] **Empty states kötü:** Planım sayfası sadece dekoratif blob → Anlamlı illüstrasyon + açıklama + aksiyon butonu
- [ ] **Bottom navigation sıradan:** Mutfak butonu yeterince vurgulanmamış → FAB olarak tasarla

#### E.1.2. Ekran Bazlı Sorunlar

**Ana Sayfa (Home):**
- [ ] Greeting basit, "clienttest1" test verisi — düzgün isim göster, fallback ekle
- [ ] "Sonraki Öğün" kartı boşken kötü görünüyor — graceful empty state
- [ ] Streak/Uyum/Su kartları küçük ve primitif — progress ring kullanan büyük kartlar
- [ ] "Tarif Motoru" / "İlerleme" butonları sade — gradient card + micro-animation
- [ ] Free kullanıcılar için "Premium'a Geç" upsell banner'ı yok
- [ ] Premium kullanıcılar için diyetisyen markalaması (logo, isim) header'da yok

**Planım:**
- [ ] **KRİTİK:** Sayfa tamamen boş, sadece decorative circles — kabul edilemez
- [ ] Plan yokken: illüstrasyon + "Diyetisyeninizle bağlanın" + "Kodu Gir" butonu + "Tarifleri Keşfet" linki
- [ ] Plan varken: tarih seçici + öğün kartları (Kahvaltı/Öğle/Akşam) + "Yaptım ✓" butonu

**Mutfak (Kitchen):**
- [ ] Hızlı Paket kartları iyileştirilmeli — daha büyük (100x120px), büyük emoji, soft gradient
- [ ] Arama çubuğu flat — glass effect, focus animasyonu, clear button
- [ ] Seçilen malzemeler alanı daralıyor — expand olsun, "Tümünü Temizle" linki
- [ ] BİRLEŞTİR butonu — pulse animasyonu, gradient (#2F5233 → #4A7C59), "{n} malzeme" sayacı
- [ ] ✅ Yükleme animasyonu (kazan) GÜZEL — KORU

**Tarif Sonuçları:**
- [ ] **KRİTİK BUG:** "Sistem taraf◆ndan tan◆mlanm◆◆ genel tarif" — UTF-8 encoding bozuk. Türkçe karakterler (ı, ş, ğ, ö, ü, ç) render edilemiyor. API response parsing'de charset kontrol et
- [ ] "Genel Tarif 11" placeholder isimleri — UI'da fallback göster
- [ ] Kartlar monoton — Klinik tariflere altın border, "Diyetisyeniniz önerdi" badge belirgin olsun
- [ ] Section header'lar yok — "Tam Uyum (12 tarif)" / "1 Eksikle Olur (8)" ayrımı ekle
- [ ] Sol border renk kodlaması: Yeşil = Tam Uyum, Sarı = 1 Eksik, Kırmızı = Uygun Değil
- [ ] Her karta öğün tipi emoji'si ekle (🍳🥗🥤)
- [ ] ✅ Sonuç sayısı badge'i (20 tarif) güzel — KORU

**Notlarım:**
- [ ] Boş durum görsel zayıf — daha sıcak illüstrasyon
- [ ] Not kartları geldiğinde: tarih, diyetisyen adı, içerik, okundu badge

**Profil:**
- [ ] Hesap bilgileri hep "—" — placeholder "Bilgilerinizi güncelleyin", tıklanınca edit mode
- [ ] Avatar/profil fotoğrafı alanı yok — varsayılan avatar + initials fallback
- [ ] ✅ Tema seçici (Açık/Koyu/Sistem) GÜZEL — KORU
- [ ] ✅ Ölçümlerim ve Gizlilik Politikası ikonları GÜZEL — KORU
- [ ] **Free kullanıcılar için "Premium Anahtarı Gir" butonu eksik — en belirgin yere ekle**
- [ ] Premium kullanıcılar için bağlı diyetisyen bilgisi gösterilmeli (isim, klinik, kalan süre)

---

### E.2. RENK SİSTEMİ

#### Light Theme Tokens
```
background-primary:    #F9F7F2   // Yulaf Beyazı (saf beyaz DEĞİL)
background-card:       #FFFFFF
surface-elevated:      #FFFFFF   // shadow ile
text-primary:          #2D3436   // Kömür (siyah DEĞİL)
text-secondary:        #636E72
text-muted:            #B2BEC3
primary:               #4A7C59   // Adaçayı Yeşili
primary-dark:          #2F5233   // Orman Yeşili (CTA butonlar)
accent-coral:          #FF8C61   // Motivasyon, gamification
accent-gold:           #F4D35E   // Premium, başarı
success:               #27AE60
warning:               #F2C94C
error:                 #EB5757
border:                #E3E8E5
```

#### Dark Theme Tokens
```
background-primary:    #0D1B2A   // Derin Lacivert (Level 0)
background-secondary:  #1B2838   // Kartlar (Level 1)
background-card:       #1E2D3D   // Kart yüzeyi (Level 1)
surface-elevated:      #253545   // Modal, dropdown (Level 2)
surface-active:        #2D4052   // Aktif elementler (Level 3)
text-primary:          #E8E8E8
text-secondary:        #A0AEC0
primary:               #5B9A6F   // Daha açık yeşil (okunabilirlik)
primary-dark:          #4A7C59
accent-coral:          #FF9A76
accent-gold:           #FFD93D
border:                #2D4052
```

**KRİTİK:** Dark mode'da tüm yüzeyler aynı renk OLMAMALI. 4 elevation seviyesi:
- Level 0: `#0D1B2A` — ana arka plan
- Level 1: `#1B2838` — kartlar
- Level 2: `#253545` — modal, dropdown
- Level 3: `#2D4052` — aktif elementler

---

### E.3. TİPOGRAFİ VE SPACİNG

**Type Scale:**
```
display:    32px / bold    / line-height 40px   → Ana sayfa greeting
h1:         28px / bold    / line-height 36px   → Ekran başlıkları
h2:         22px / semibold/ line-height 28px   → Bölüm başlıkları
h3:         18px / semibold/ line-height 24px   → Kart başlıkları
body:       16px / regular / line-height 22px   → Gövde metin
body-sm:    14px / regular / line-height 20px   → İkincil metin
caption:    13px / regular / line-height 18px   → Etiket, tarih
overline:   11px / semibold/ line-height 16px   → Üst etiket, kategori
```

**8px Grid Spacing:**
```
xs:   4px    → İç element boşlukları
sm:   8px    → Chip'ler arası, ikon-metin arası
md:   12px   → Kart iç padding (compact)
base: 16px   → Standart padding, kartlar arası
lg:   24px   → Bölümler arası
xl:   32px   → Ekran kenarları
xxl:  48px   → Major bölümler arası
```

**Border Radius:**
```
sm:   8px    → Chip, badge, küçük buton
md:   12px   → Butonlar, input
lg:   16px   → Kartlar
xl:   20px   → Büyük kartlar, modal
full: 9999px → Avatar, FAB
```

---

### E.4. EKRAN EKRAN TASARIM TALİMATLARI

#### E.4.1. Ana Sayfa (HomeScreen)

**Free kullanıcı wireframe:**
```
┌──────────────────────────────────┐
│ İyi akşamlar,                    │
│ Mert 👋              [🔔]       │
│ 14 Mart Cumartesi                │
├──────────────────────────────────┤
│ ┌─ Soft Upsell Banner ────────┐ │
│ │ 🔑 Diyetisyeninle mi        │ │
│ │ çalışıyorsun?  [Kodu Gir →] │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌───────┐ │
│ │ 🔥     │ │ 📊     │ │ 💧    │ │
│ │  3     │ │  %72   │ │  5    │ │
│ │  gün   │ │  uyum  │ │  brd. │ │
│ │ Seri   │ │        │ │  Su   │ │
│ └────────┘ └────────┘ └───────┘ │
├──────────────────────────────────┤
│ ┌──────────────┐┌──────────────┐ │
│ │ 🍳 Tarif     ││ 📈 İlerleme  │ │
│ │  Motoru      ││  Takibi      │ │
│ │ Malzemelerden││ Gelişimini   │ │
│ │ tarif bul    ││ gör          │ │
│ └──────────────┘└──────────────┘ │
├──────────────────────────────────┤
│ Haftanın Popülerleri        Tümü│
│ ←  [Kart1] [Kart2] [Kart3]  →  │
└──────────────────────────────────┘
```

**Premium kullanıcı farkları:**
- Header: "Dyt. Elif ile Sağlıklı Yaşam" + diyetisyen logosu (branding API'den)
- Upsell banner yerine: "Sıradaki Öğün" kartı (plan API'den)
- Uyum kartı büyük: Halka grafik (donut chart) ile %85
- Oyunlaştırma alanı: rozetler, streaks
- `isPremium` kontrolü ile `FreeHome` ve `PremiumHome` ayrı bileşenler oluştur

**API Mapping:**
- Free: `GET /api/public/recipes`, `GET /api/client/me`
- Premium: `GET /api/client/plans/today`, `GET /api/client/branding`, `GET /api/client/me`

#### E.4.2. Planım (PlansScreen)

**Empty state (plan yokken):**
```
┌──────────────────────────────────┐
│ Planım                           │
│ 14 Mart Cumartesi                │
├──────────────────────────────────┤
│                                  │
│       [📅 Takvim İllüstrasyon]   │
│                                  │
│    Henüz bir planınız yok        │
│                                  │
│    Diyetisyeninizden aldığınız   │
│    kodla kişisel planınıza       │
│    ulaşabilirsiniz.              │
│                                  │
│    [🔑 Premium Kodu Gir]        │
│                                  │
│    ─── veya ───                  │
│                                  │
│    [Genel Tarifleri Keşfet →]   │
└──────────────────────────────────┘
```

**Plan varken:**
- Horizontal date picker (bugün vurgulanmış)
- Öğün kartları: Kahvaltı → Ara Öğün → Öğle → Akşam
- Her öğün kartı: emoji + tarif adı + süre + "Yaptım ✓" butonu
- Tamamlanan öğünler: check mark, opacity düşük

#### E.4.3. Mutfak (KitchenScreen)

**İyileştir ama KORU:**
- ✅ Hızlı Paketler horizontal scroll — KORU, kartları büyüt
- ✅ Malzeme arama çubuğu — KORU, glass effect ekle
- ✅ Seçilen malzemeler chip listesi — KORU, expand + "Tümünü Temizle"
- ✅ "BİRLEŞTİR" butonu — KORU, pulse animasyonu + gradient + "{n} malzeme"
- ✅ Yükleme animasyonu (kazan) — KORU

**Tez sunumu için önemli:** Mutfak ekranı, normalizasyon pipeline'ının kullanıcıya görünen yüzüdür. Kullanıcı "suzme yogrt" yazıp arama yaptığında, backend fuzzy match ile "Süzme Yoğurt"u bulabilmeli. Bu mobilde doğru çalıştığını GÖSTER.

#### E.4.4. Tarif Sonuçları (RecipeResultsScreen)

**Kart Tasarımı:**
```
┌─ ── ── ── ── ── ── ── ── ── ┐
│ 🥗 Sebzeli Omlet             │
│ ⏱ 15dk · ✅ Tam Uyum         │
│ Yumurta bazlı kahvaltı       │
│ Opsiyonel eşleşme: 1         │
│                    [Detay →]  │
└─ ── ── ── ── ── ── ── ── ── ┘
  ↑ Sol border: Yeşil (#27AE60)
```

**Klinik Tarifi (altın border):**
```
┌─ ── ── ── ── ── ── ── ── ── ┐
│ ⭐ Tavuk Salatası              │
│ 🏥 Klinik Tarifi              │
│ ⏱ 20dk · ✅ Tam Uyum          │
│ "Diyetisyeniniz önerdi"       │
│                    [Detay →]   │
└─ ── ── ── ── ── ── ── ── ── ┘
  ↑ Sol border: Altın (#F4D35E)
```

**Section Headers:**
- "Tam Uyum (12 tarif)" — yeşil ikon
- "1 Eksikle Olur (8 tarif)" — sarı ikon
- "Alternatifli Eşleşme (3 tarif)" — turuncu ikon

**Tez sunumu için önemli:** Bu ekran, tarif öneri motorunun çıktısıdır. Zorunlu/opsiyonel/alternatif ayrımının görsel olarak net olması gerekir. Tez jürisine bu ekranı göstereceksin.

**UTF-8 FIX — EN YÜKSEK ÖNCELİK:**
"Sistem taraf◆ndan tan◆mlanm◆◆" → Türkçe karakterler bozuk. Bu bug tez sunumunda FELAKET olur. Şunları kontrol et:
1. API response'da Content-Type header'ında charset=utf-8 var mı?
2. Fetch/axios konfigürasyonunda responseType ve encoding ayarları
3. React Native'de Text component'inin Türkçe karakter desteği
4. Backend JSON serialization'da encoding ayarı

#### E.4.5. Profil (ProfileScreen)

**Layout:**
```
┌──────────────────────────────────┐
│         [Avatar Circle]          │
│         Mert Yılmaz              │
│         mert@email.com           │
│         [Profili Düzenle]        │
├──────────────────────────────────┤
│ ── Premium Durumu ──             │
│ Free → [🔑 Premium Anahtarı Gir]│
│ Prem → [👨‍⚕️ Dyt.Elif · 45 gün]   │
├──────────────────────────────────┤
│ Tema: [Açık] [Koyu] [Sistem]    │
├──────────────────────────────────┤
│ HESAP BİLGİLERİ                 │
│ Ad Soyad          Mert Yılmaz   │
│ E-posta       mert@email.com    │
│ Cinsiyet             Erkek      │
│ Doğum Tarihi     01.01.1995     │
├──────────────────────────────────┤
│ DESTEK                           │
│ 📏 Ölçümlerim                →  │
│ 🔒 Gizlilik Politikası       →  │
│ ℹ️  Uygulama Hakkında         →  │
├──────────────────────────────────┤
│ [Oturumu Kapat]                  │
└──────────────────────────────────┘
```

---

### E.5. COMPONENT LIBRARY

`src/components/ui/` altında oluştur:

**Base Components:**
```
AppCard.tsx           — Standart kart (shadow, radius, padding, theme-aware)
AppButton.tsx         — Primary, Secondary, Outlined, Ghost varyantları
AppChip.tsx           — Tag/chip (selected/unselected)
AppBadge.tsx          — Sayı veya durum badge
AppEmptyState.tsx     — İllüstrasyon + başlık + açıklama + buton
AppAvatar.tsx         — Fotoğraf veya initials fallback
AppProgressRing.tsx   — Circular progress (uyum skoru)
AppSectionHeader.tsx  — Bölüm başlığı (sol metin + sağ aksiyon)
```

**Domain Components:**
```
RecipeCard.tsx        — Sol renk şeridi + eşleşme bilgisi + emoji
StatsCard.tsx         — İkon + sayı + etiket (streak, uyum, su)
QuickPackCard.tsx     — Hızlı paket (mutfak)
IngredientChip.tsx    — Seçili malzeme chip (X ile kaldır)
MealCard.tsx          — Öğün kartı (plan ekranı)
UpsellBanner.tsx      — Premium yönlendirme
DietitianHeader.tsx   — Diyetisyen markalı header (premium)
```

---

### E.6. BOTTOM TAB BAR

```
┌──────┬──────┬───────────┬──────┬──────┐
│  🏠  │  📋  │   ◆◆◆◆    │  📝  │  👤  │
│ Home │ Plan │  MUTFAK   │ Not  │ Prof │
│      │      │   (FAB)   │      │      │
└──────┴──────┴───────────┴──────┴──────┘
```

- Mutfak: **%30 daha büyük**, yukarı taşan FAB, `#2F5233` arka plan, beyaz ikon, belirgin shadow
- Aktif tab: primary green ikon + label
- Pasif tab: muted gray ikon + label
- Tab bar: Light'da beyaz + üst border, Dark'da surface-1 + üst border

---

### E.7. ANİMASYONLAR

- **Ekran geçişleri:** Fade + SlideFromRight
- **Kart basma:** Scale 0.97 + shadow değişimi (Reanimated)
- **BİRLEŞTİR:** Malzeme eklendiğinde pulse + sayaç animasyonu
- **Kutu Açılışı:** Mevcut kazan animasyonunu koru, kartlar staggered fade-in
- **Chip ekleme/çıkarma:** Layout animation
- **Progress ring:** Count-up animasyonu
- **Haptic Feedback:** Button → Light, BİRLEŞTİR → Medium, Başarı → Success

---

## ════════════════════════════════════════
## BÖLÜM F — TEZ SUNUMUNA HAZIRLAMA
## ════════════════════════════════════════

### F.1. Demo Senaryosu (Tez Jürisine Gösterilecek)

Bu akış baştan sona çalışmalı:

**Adım 1 — Diyetisyen (Web Panel):**
1. Diyetisyen login
2. "Yoğurtlu Yulaf Kasesi" tarifi oluştur
   - Yoğurt → Zorunlu
   - Yulaf → Zorunlu
   - Muz → Opsiyonel
   - Meyveli Yoğurt → Yasaklı varyant
3. Access Key üret (3 aylık)
4. Kodu kaydet

**Adım 2 — Danışan (Mobil):**
1. Client register / login
2. Free Home ekranı görünsün
3. Profil → "Premium Anahtarı Gir" → kodu gir
4. Premium Home'a geçiş (diyetisyen markalaması görünsün)
5. Mutfak sekmesi → malzeme gir: "suzme yogurt", "yulaf", "muz"
   - **BURADA NORMALIZASYON GÖSTERİLECEK:** "suzme yogurt" → Süzme Yoğurt (fuzzy/alias match)
6. BİRLEŞTİR → kazan animasyonu → sonuçlar
7. "Yoğurtlu Yulaf Kasesi" → "Tam Uyum" olarak çıkmalı
8. Klinik tarifi badge'i görünmeli

**Adım 3 — Benchmark (Opsiyonel):**
- Normalizasyon log ekranı veya raporu göster
- Exact: %60, Alias: %20, Fuzzy: %15, LLM: %3, Unmatched: %2

### F.2. Tez Sunumu İçin Kritik Kontroller

- [ ] Demo senaryosu baştan sona hatasız çalışıyor
- [ ] Türkçe karakterler HER YERDE düzgün
- [ ] Boş sayfalar yok (her ekranın bir anlamı var)
- [ ] Seed data gerçekçi (test1, test2 gibi isimler yerine Türkçe isimler)
- [ ] Normalizasyon katmanları loglanıyor ve gösterilebilir
- [ ] Tarif öneri sonuçları açıklanabilir (neden bu tarif önerildi?)
- [ ] Web panel üzerinden tarif oluşturma çalışıyor
- [ ] Access Key akışı çalışıyor (üret → gir → premium ol)

---

## ════════════════════════════════════════
## BÖLÜM G — ÖNCELİK SIRASI VE FAZLAR
## ════════════════════════════════════════

### FAZ 0 — KONTROL (1 saat)
```
□ Backend build et → 0 error
□ Smoke testleri çalıştır → 7/7 pass
□ Web panel build et → hatasız
□ Mobil uygulamayı çalıştır → hata log'larını oku
□ UTF-8 encoding bug'ını tespit et
□ Mevcut dosya yapısını raporla
```

### FAZ 1 — KRİTİK FIX'LER (En Yüksek Öncelik)
```
□ UTF-8 Türkçe karakter fix (tarif sonuçları)
□ Planım sayfası empty state (boş sayfa düzeltme)
□ Profil sayfası "Premium Anahtarı Gir" butonu ekleme
□ Seed data'da Türkçe gerçekçi isimler (Genel Tarif 11 → Sebzeli Menemen)
□ Tüm ekranlarda null/undefined fallback kontrolleri
```

### FAZ 2 — TEMA VE FOUNDATION (Yüksek Öncelik)
```
□ theme/colors.ts — Light + Dark token'ları
□ theme/typography.ts — Type scale
□ theme/spacing.ts — 8px grid
□ AppCard, AppButton, AppEmptyState base component'leri
□ Bottom Tab Bar yeniden tasarım (Mutfak FAB)
```

### FAZ 3 — EKRAN TASARIMLARI (Yüksek Öncelik)
```
□ Ana Sayfa: Free/Premium ayrımı, stat kartları, greeting
□ Mutfak: Hızlı paket kartları, arama, BİRLEŞTİR iyileştirmeleri
□ Tarif Sonuçları: RecipeCard tasarımı, section headers, renk kodlaması
□ Planım: Empty state + plan görünümü
□ Notlarım: Empty state + not kartı
□ Profil: Avatar, premium status, bilgi doluluk
```

### FAZ 4 — DEMO HAZIRLIK (Orta Öncelik)
```
□ Demo senaryosunu baştan sona test et
□ Normalizasyon pipeline'ın mobilde çalıştığını doğrula
□ Access Key akışını test et (web panel → mobil)
□ Klinik tarifi badge'i ve premium deneyim kontrolü
□ Benchmark veri seti hazırla (en az 50 test girdisi)
```

### FAZ 5 — POLISH (Düşük Öncelik — zaman kalırsa)
```
□ Animasyonlar ve micro-interactions
□ Onboarding flow (3 ekran)
□ Premium aktivasyon konfeti animasyonu
□ Haptic feedback
□ Web panel KPI dashboard verilerini bağlama
□ Benchmark raporu görselleştirme
```

---

## ════════════════════════════════════════
## BÖLÜM H — MUTLAK KURALLAR
## ════════════════════════════════════════

1. **Backend kodunu DEĞİŞTİRME.** Backend frozen. Bir şey bozuksa RAPORLA, birlikte çözeriz.
2. **API endpoint'lerini DEĞİŞTİRME.** Canonical route'ları kullan. Path değiştirme.
3. **Mevcut çalışan mantığı BOZMA.** Tema değişikliği, auth, navigasyon korunmalı.
4. **Küçük adımlarla ilerle.** Her değişiklikten sonra build al, test et.
5. **Türkçe UI.** Tüm metinler Türkçe olmalı.
6. **Null safety.** Boş/null/undefined değerler için her yerde graceful fallback.
7. **Performans.** FlatList kullan, image lazy loading, memo.
8. **Her görev sonunda raporla:** Ne değişti, nasıl doğrulandı, ne kaldı.
9. **Scope genişletme.** İstenmediği sürece yeni özellik ekleme, mevcut olan düzelt.
10. **Tez odağını koru.** Bu bir "tarif uygulaması" değil — bu "çok katmanlı normalizasyon ve kural tabanlı öneri sistemi". Her UI kararı bu teknik hikayeyi desteklemeli.

---

## ════════════════════════════════════════
## BÖLÜM I — DOSYA YAPISI ÖNERİSİ (MOBİL)
## ════════════════════════════════════════

```
mobile-app/src/
├── components/
│   ├── ui/                     # Reusable base
│   │   ├── AppCard.tsx
│   │   ├── AppButton.tsx
│   │   ├── AppChip.tsx
│   │   ├── AppBadge.tsx
│   │   ├── AppEmptyState.tsx
│   │   ├── AppAvatar.tsx
│   │   ├── AppProgressRing.tsx
│   │   └── AppSectionHeader.tsx
│   ├── home/
│   │   ├── FreeHome.tsx
│   │   ├── PremiumHome.tsx
│   │   ├── StatsCard.tsx
│   │   └── UpsellBanner.tsx
│   ├── kitchen/
│   │   ├── QuickPackCard.tsx
│   │   ├── IngredientChip.tsx
│   │   └── MergeButton.tsx
│   ├── recipes/
│   │   ├── RecipeCard.tsx
│   │   └── RecipeSection.tsx
│   ├── plans/
│   │   ├── MealCard.tsx
│   │   └── DatePicker.tsx
│   └── profile/
│       ├── AvatarSection.tsx
│       └── PremiumStatusCard.tsx
├── theme/
│   ├── colors.ts               # Light + Dark tokens
│   ├── typography.ts           # Type scale
│   ├── spacing.ts              # 8px grid
│   └── index.ts                # Merged theme export
├── navigation/
│   └── BottomTabNavigator.tsx  # FAB tasarımlı tab bar
├── screens/
│   ├── HomeScreen.tsx
│   ├── PlansScreen.tsx
│   ├── KitchenScreen.tsx
│   ├── RecipeResultsScreen.tsx
│   ├── NotesScreen.tsx
│   └── ProfileScreen.tsx
├── api/
│   └── client.ts               # API wrapper (UTF-8 kontrollü)
└── hooks/
    ├── useTheme.ts
    └── useAuth.ts
```

---

## ════════════════════════════════════════
## BÖLÜM J — BAŞLANGIÇ TALİMATI
## ════════════════════════════════════════

Claude Code, bu prompt'u aldığında şu sırayla başla:

1. **Proje kök dizinini bul ve yapısını raporla** — `ls`, `find` komutları ile
2. **Backend build kontrolü yap** — `dotnet build -c Release`
3. **Smoke testlerini çalıştır** — `dotnet test -c Release`
4. **Mobil uygulama bağımlılıklarını kontrol et** — `package.json`, `node_modules`
5. **Web panel bağımlılıklarını kontrol et**
6. **Mevcut tema/renk dosyalarını bul ve oku**
7. **UTF-8 encoding bug'ını araştır** — API client kodu, fetch/axios config
8. **RAPORLA:** Ne bulduğunu, ne çalıştığını, ne bozuk olduğunu

Sonra FAZ 0'dan başlayarak ilerle.

**Bu projeyi birlikte bitireceğiz. Her adımda bana ne yaptığını ve ne bulduğunu söyle.**
