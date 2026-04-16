# MyDietitian Mobile App — Proje Durum Analizi

> **Tarih:** 2026-03-23
> **Branch:** `chore/backend-freeze-final`
> **Kapsam:** Tüm katmanlar — Backend API, Mobile App, Web Panel, Test, Dev Environment

---

## İçindekiler

1. [Genel Özet](#1-genel-özet)
2. [Mimari Harita](#2-mimari-harita)
3. [Backend Durumu](#3-backend-durumu)
4. [Mobile App Durumu](#4-mobile-app-durumu)
5. [Web Panel Durumu](#5-web-panel-durumu)
6. [Test Durumu](#6-test-durumu)
7. [Dev Environment](#7-dev-environment)
8. [Açık Sorunlar ve Riskler](#8-açık-sorunlar-ve-riskler)
9. [Sonraki Adımlar](#9-sonraki-adımlar)
10. [Referans: Tüm Endpoint Listesi](#10-referans-tüm-endpoint-listesi)

---

## 1. Genel Özet

**MyDietitian**, diyetisyen-danışan ilişkisini yöneten çok katmanlı bir SaaS platformudur.

| Katman | Teknoloji | Durum |
|---|---|---|
| Backend API | ASP.NET Core 8 / PostgreSQL | ✅ Backend Freeze tamamlandı |
| Mobile App | React Native / Expo SDK 54 | 🟡 Temel akışlar çalışıyor, bazı ekranlar eksik |
| Web Panel | Next.js 14 / Tailwind | 🟡 Çoğu sayfa tamam, bazı API entegrasyonları eksik |
| Test Altyapısı | xUnit + Smoke Tests | ✅ Kapsamlı smoke test suite mevcut |
| Dev Environment | adb reverse + localhost | ✅ Stabil hale getirildi |

### Projenin Temel Özellikleri

```
Free kullanıcı    →  Genel tarifler (15 adet), malzeme eşleştirme
Premium kullanıcı →  Günlük diyet planı, uyum takibi, alternatif önerisi
Diyetisyen        →  Danışan yönetimi, tarif CRUD, plan oluşturma, raporlama
Admin             →  Malzeme yönetimi, sistem düzeyinde işlemler
```

---

## 2. Mimari Harita

```
┌─────────────────────────────────────────────────────────────┐
│                     İstemci Katmanı                         │
│                                                             │
│  ┌───────────────────┐    ┌───────────────────────────┐    │
│  │  Mobile App        │    │  Web Panel                │    │
│  │  React Native      │    │  Next.js 14               │    │
│  │  Expo SDK 54       │    │  Diyetisyen + Admin UI    │    │
│  └────────┬──────────┘    └────────────┬──────────────┘    │
│           │ http://127.0.0.1:5000        │ http://localhost:3000 │
│           │ (adb reverse)               │                   │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
┌───────────▼─────────────────────────────▼───────────────────┐
│                  ASP.NET Core 8 API                         │
│                  http://0.0.0.0:5000                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Auth    │  │  Client  │  │Dietitian │  │  Admin   │  │
│  │  /api/   │  │  /api/   │  │  /api/   │  │  /api/   │  │
│  │  auth/*  │  │  client/*│  │  dieti..│  │  admin/* │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Layer (CQRS / MediatR)                 │   │
│  │  17 Commands + Handlers, 10+ Services               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Domain Layer                                       │   │
│  │  38 Entity, Ingredient Taxonomy, Meal Plan Domain   │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │  PostgreSQL (Port 5433)          │
              │  AppDb + AuthDb (shared instance)│
              └─────────────────────────────────┘
```

---

## 3. Backend Durumu

### 3.1 Genel

- **Durum:** Backend Freeze — tüm planlı endpoint'ler implement edildi
- **Listening:** `http://0.0.0.0:5000` + `https://0.0.0.0:7154`
- **Profile:** `dotnet run --launch-profile http` ile başlatılmalı
- **DB:** PostgreSQL `localhost:5433`, veritabanı adı `mydietitian_dev`

### 3.2 Controller Envanteri (30 Controller)

| # | Controller | Route Prefix | Yetki | Durum |
|---|---|---|---|---|
| 1 | AuthenticationController | `/api/auth` | Public | ✅ |
| 2 | ClientAuthenticationController | `/api/auth` | Public | ✅ |
| 3 | ClientController | `/api/client` | Client | ✅ |
| 4 | ClientStateController | `/api/client` | Client | ✅ |
| 5 | DashboardController | `/api/client` | Client+Premium | ✅ |
| 6 | ClientPlanController | `/api/client` | Client+Premium | ✅ |
| 7 | ClientProgressController | `/api/client` | Client | ✅ |
| 8 | ClientComplianceController | `/api/client` | Client | ✅ |
| 9 | ClientBrandingController | `/api/client` | Client | ✅ |
| 10 | ClientDietitianInfoController | `/api/dietitian` | Client | ✅ |
| 11 | ClientNotesController | `/api/client` | Client | ✅ |
| 12 | KitchenController | `/api/client/kitchen` | Client | ✅ |
| 13 | AlternativeController | `/api/alternative` | Client | ✅ |
| 14 | DietitianManagementController | `/api/dietitian` | Dietitian | ✅ |
| 15 | DietitianPlanController | `/api/dietitian/plans` | Dietitian | ✅ |
| 16 | DietitianDailyPlanController | `/api/dietitian/daily-plans` | Dietitian | ✅ |
| 17 | DietitianRecipesController | `/api/dietitian/recipes` | Dietitian | ✅ |
| 18 | DietitianBrandingController | `/api/dietitian` | Dietitian | ✅ |
| 19 | DietitianSettingsController | `/api/dietitian/settings` | Dietitian | ✅ |
| 20 | DietitianNotesController | `/api/dietitian` | Dietitian | ✅ |
| 21 | DietitianReportingController | `/api/dietitian` | Dietitian | ✅ |
| 22 | ClientAnalyticsController | `/api/dietitian/clients/{id}/analytics` | Dietitian | ✅ |
| 23 | RetentionController | `/api/dietitian/retention` | Dietitian | ✅ |
| 24 | IngredientController | `/api` | Admin/Dietitian | ✅ |
| 25 | IngredientPackController | `/api/ingredients/packs` | Mixed | ✅ |
| 26 | RecipeMatchController | `/api/recipes` | Client | ✅ |
| 27 | PublicRecipesController | `/api/public` | Public | ✅ |
| 28 | AdminController | `/api/admin` | Admin | ✅ |
| 29 | HealthController | `/health` | Public | ✅ |
| 30 | DevController | `/api/dev` | Dev only | ✅ |

### 3.3 Veritabanı Şeması

**12 Migration tamamlandı.** Son migration: `Sprint1_MealTypeAndAlternativeCompletion` (16 Mar 2026)

**Ana DbSet'ler (AppDb):**

```
Core           : Dietitian, Client, DietitianClientLink, AccessKey
Tarif          : Recipe, RecipeIngredient, RecipeSubstitute, RecipeProhibition
Malzeme        : Ingredient, IngredientPack, IngredientPackItem
Taksonomi      : IngredientFamily, IngredientFamilyMember, IngredientCompatibilityRule
Diyet Planı    : MealPlan, PlanMealItem, MealCompletion, ClientMealPlan, ClientMeal
Uyum Takibi    : ClientDailyTracking, ClientWeightEntry, ClientMeasurementEntry, ClientActivity
                 DailyComplianceSnapshot, MealCompliance
Diyetisyen     : DietitianBrandingConfig, DietitianSettings, DietitianNote, UserMeasurement
Legacy         : DietPlan, DietPlanDay, DietPlanMeal, MealItem, MealItemCompliance
Log            : IngredientNormalizationLog, RecipeRecommendationLog, PremiumAuditLog
```

### 3.4 Önemli Servisler

| Servis | Açıklama | Özellik |
|---|---|---|
| `IngredientNormalizationService` | 4 kademeli arama | DB eşleşme → Fuzzy → LLM → Taksonomi |
| `RecipeRecommendationEngine` | Tarif eşleştirme | Puan tabanlı, FULL/ONE_MISSING |
| `AlternativeMealDecisionService` | Alternatif önerisi | Malzeme uyumluluğu kontrolü |
| `PremiumStatusService` | Abonelik kontrolü | Sunucu taraflı doğrulama |
| `ClientIdentityResolver` | IDOR koruması | Her istekte kimlik doğrulama |
| `ComplianceCalculationService` | Uyum puanı | Günlük snapshot hesaplama |

### 3.5 Rate Limiting

| Policy | Limit | Pencere | Kapsam |
|---|---|---|---|
| `auth` | 5 istek | 10 saniye | IP bazlı (sliding) |
| `auth-strict` | 10 istek | 1 dakika | IP bazlı (fixed) |
| `activation` | 10 deneme | 5 dakika | Kullanıcı bazlı |
| `keygen` | 20 üretim | 10 dakika | Diyetisyen bazlı |
| `dietitian-write` | 60 yazma | 10 dakika | Diyetisyen bazlı |
| `kitchen` | 30 işlem | 1 dakika | Danışan bazlı |
| `telemetry-write` | 120 event | 1 dakika | Danışan bazlı |

---

## 4. Mobile App Durumu

### 4.1 Genel

- **Framework:** React Native / Expo SDK 54
- **React:** 19.1.0
- **Navigasyon:** React Navigation v7
- **State:** TanStack Query v5 + AuthContext
- **HTTP:** Axios

### 4.2 Ekran Envanteri (15 Ekran)

| Ekran | Route | Erişim | Durum |
|---|---|---|---|
| WelcomeScreen | Auth.Welcome | Public | ✅ |
| LoginScreen | Auth.Login | Public | ✅ |
| RegisterScreen | Auth.Register | Public | ✅ |
| FreeHomeScreen | Free.Home | Free user | ✅ |
| PremiumActivationScreen | Free.ActivatePremium | Free user | ✅ |
| DashboardScreen | App.Shell > Tab | Authenticated | ✅ |
| PlansScreen | App.Shell > Tab | Premium | ✅ |
| KitchenScreen | App.Shell > Tab | Authenticated | ✅ |
| KitchenResultScreen | App.KitchenResult | Authenticated | ✅ |
| CheckIngredientsScreen | App.CheckIngredients | Premium | ✅ |
| AlternativeResultScreen | App.AlternativeResult | Premium | ✅ |
| ProfileScreen | App.Shell > Tab | Authenticated | ✅ |
| ProfileMeasurementsScreen | App.ProfileMeasurements | Authenticated | ✅ |
| MessagesScreen | App.Shell > Tab | Authenticated | 🟡 Placeholder |
| TodayScreen | - | Premium | 🟡 Plans ile birleşik |

### 4.3 API Modülleri (8 Dosya)

```
src/api/
├── auth.ts          → POST /api/auth/client/register, /login
├── client.ts        → Axios instance, interceptors, startup probe
├── client-state.ts  → GET /api/client/me
├── alternative.ts   → GET /api/ingredients/search, POST /api/alternative/decide
├── diet-plans.ts    → GET /api/diet-plans/today
├── kitchen.ts       → POST /api/recipes/match, GET /api/ingredients/packs
│                       POST/DELETE /api/client/meals/{id}/complete
├── profile.ts       → GET /api/client/me
└── health.ts        → GET /health (startup connectivity probe)
```

### 4.4 Bağlantı Stratejisi (adb reverse)

**Mevcut konfigürasyon (`.env`):**
```env
EXPO_PUBLIC_API_BASE_URL_FORCE=1
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

**Çalışma sırası:**
```bash
# 1. Backend
dotnet run --launch-profile http

# 2. Port tüneli (her emülatör oturumunda bir kez)
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081

# 3. Metro
npx expo start --localhost --clear
```

**Neden `10.0.2.2` yerine `adb reverse`?**

| Kriter | `10.0.2.2` | `adb reverse` |
|---|---|---|
| Windows Firewall | Kural gerektirir | Gereksiz |
| LAN IP değişirse | Bozulur | Etkilenmez |
| Fiziksel cihazda da çalışır | Hayır | Evet |
| Config sabit kalır | Hayır | Evet (`127.0.0.1` sabittir) |

### 4.5 URL Çözümleme Akışı (`config/api.ts`)

```
EXPO_PUBLIC_API_BASE_URL_FORCE=1 ve URL set ise
  → validate + normalize → kullan (ASLA override etme)

FORCE=0 ama URL set ise
  → validate + normalize → kullan

Hiçbiri yoksa
  → http://127.0.0.1:5000 (adb reverse / iOS sim default)
```

> **Önemli:** Self-heal / baseURL mutation **tamamen kaldırıldı**. Runtime'da URL hiçbir zaman otomatik değiştirilmez.

### 4.6 Tema Sistemi

```
src/theme/
├── tokens.ts     → Primitives (renkler, spacing, radii, typography)
├── colors.ts     → Semantic color mappings (light + dark)
├── spacing.ts    → Spacing scale
├── radii.ts      → Border radius scale
├── typography.ts → Font stack
└── index.ts      → Barrel export

src/context/ThemeContext.tsx → ThemeProvider, useTheme hook
```

---

## 5. Web Panel Durumu

### 5.1 Genel

- **Framework:** Next.js 14 (App Router)
- **Dil:** TypeScript
- **CSS:** Tailwind CSS
- **HTTP:** Axios
- **i18n:** next-intl

### 5.2 Sayfa Envanteri (40 TSX Dosyası)

**Auth:**
- `/auth/login` — Diyetisyen girişi
- `/auth/register` — Diyetisyen kaydı
- `/auth/client-access` — Danışan erişim kodu girişi

**Admin:**
- `/admin/login` — Admin girişi
- `/admin/ingredients` — Malzeme yönetimi

**Diyetisyen Dashboard (13 sayfa):**
- `/dashboard` — Genel bakış
- `/dashboard/access-keys` — Erişim kodu yönetimi
- `/dashboard/branding` — Marka/logo ayarları
- `/dashboard/clients` — Danışan listesi
- `/dashboard/clients/[clientId]` — Danışan detayı
- `/dashboard/diet-plans` — Diyet planları listesi
- `/dashboard/diet-plans/create` — Plan oluşturma
- `/dashboard/diet-plans/[clientId]` — Danışana özel plan
- `/dashboard/plans` — Plan görünümü
- `/dashboard/recipe-match` — Tarif eşleştirme UI
- `/dashboard/recipes` — Tarif listesi
- `/dashboard/recipes/create` — Tarif oluşturma
- `/dashboard/retention` — Retention analitik
- `/dashboard/settings` — Hesap ayarları

**API Routes (Next.js server-side):**
- `/api/[...path]` — Backend'e proxy
- `/api/dietitian/settings/logo` — Logo yükleme
- `/api/dietitian/dashboard/activity` — Aktivite metrikleri
- `/api/dietitian/dashboard/stats` — Dashboard istatistikleri

### 5.3 Durum

🟡 Çoğu sayfa implement edildi ancak bazı sayfalarda API entegrasyonları test edilmemiş olabilir.

---

## 6. Test Durumu

### 6.1 Test Dosyaları (24 Dosya)

**Smoke Tests (entegrasyon):**
```
AuthSmokeTests.cs                        → Auth akışları
DietitianClientAccessSmokeTests.cs       → Erişim kontrolü
HappyPathScenarioSmokeTests.cs           → Uçtan uca senaryolar
IngredientSearchAndAlternativeSmokeTests → Arama + alternatif
PremiumGatingSmokeTests.cs               → Premium kapı kontrolü
EndpointInventorySmokeTests.cs           → Route doğrulama
```

**Unit Tests:**
```
FuzzyNormalizationTests.cs               → Fuzzy eşleştirme
IngredientNormalizationServiceTests.cs   → Normalizasyon servisi
IngredientTaxonomyServiceTests.cs        → Taksonomi servisi
LlmNormalizationTests.cs                 → LLM entegrasyonu
NormalizedSearchIntegrationTests.cs      → Arama pipeline
RecipeRecommendationEngineTests.cs       → Tarif eşleştirme
BenchmarkRunnerTests.cs                  → Performans
AuthRateLimitTests.cs                    → Rate limiting
RevokePremiumTests.cs                    → Premium iptali
```

**Altyapı:**
```
SmokeWebApplicationFactory.cs            → Test host (in-memory DB)
SmokeTestSeeder.cs                       → Test verisi üretimi
CustomWebApplicationFactory.cs           → DI konfigürasyonu
```

### 6.2 Smoke Test Çalıştırma

```bash
# Bash
./scripts/run-smoke-tests.sh

# PowerShell
.\scripts\run-smoke-tests.ps1

# Manuel
cd tests/MyDietitianMobileApp.Api.SmokeTests
dotnet test
```

---

## 7. Dev Environment

### 7.1 Gereksinimler

| Araç | Versiyon | Amaç |
|---|---|---|
| .NET SDK | 8.x | Backend |
| Node.js | 20.x+ | Mobile + Web |
| PostgreSQL | 15+ | Veritabanı |
| Android SDK / ADB | Herhangi | Emülatör tüneli |
| Expo CLI | SDK 54 uyumlu | Metro bundler |

### 7.2 Servis Portları

| Servis | Port | Protokol |
|---|---|---|
| ASP.NET Core (HTTP) | 5000 | HTTP |
| ASP.NET Core (HTTPS) | 7154 | HTTPS |
| PostgreSQL | 5433 | TCP |
| Metro Bundler | 8081 | HTTP |
| Next.js Web Panel | 3000 | HTTP |

### 7.3 Tam Başlatma Sırası

```bash
# Terminal 1 — PostgreSQL (çalışıyor olmalı)
# Port 5433'te dinlemeli

# Terminal 2 — Backend
cd src/MyDietitianMobileApp.Api
dotnet run --launch-profile http

# Terminal 3 — adb reverse (emülatör açıldıktan sonra)
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081

# Terminal 4 — Expo
cd mobile-app
npx expo start --localhost --clear

# Terminal 5 (opsiyonel) — Web Panel
cd web-panel
npm run dev
```

### 7.4 Sağlık Kontrolü

Backend çalışıyor mu?
```bash
curl http://localhost:5000/health
# {"status":"healthy","timestamp":"...","environment":"Development","version":"dev"}
```

Emülatör bağlantısı çalışıyor mu?
Uygulama açıldığında logcatta görünmesi gereken:
```
✅ Backend reachable in ~Xms → Development | http://127.0.0.1:5000/health
```

---

## 8. Açık Sorunlar ve Riskler

### 8.1 Bilinen Eksiklikler

| # | Alan | Sorun | Öncelik |
|---|---|---|---|
| 1 | Mobile / MessagesScreen | Placeholder — backend mesajlaşma endpoint'i yok | Düşük |
| 2 | Mobile / TodayScreen | Plans ile birleşik, ayrı ekran yok | Orta |
| 3 | Mobile / Offline Mode | Token varsa offline geçiyorsa user=null kalıyor | Düşük |
| 4 | Web Panel | Bazı dashboard sayfalarında API bağlantısı test edilmedi | Orta |
| 5 | Backend / Legacy Schema | `DietPlan` / `DietPlanMeal` legacy tablolar hâlâ mevcut, temizlenmemiş | Düşük |
| 6 | Backend / LLM | `OpenAiIngredientLlmClient` disabled — production API key yok | Düşük |
| 7 | JWT / `isTestingLikeEnv` | Development'da issuer/audience doğrulaması devre dışı | Orta |

### 8.2 Teknik Borç

| Alan | Durum |
|---|---|
| CORS | Sadece `localhost:3000` — production origin eklenmeli |
| JWT Expiry | 43200 dakika (30 gün) — production için azaltılmalı |
| Shared DB | AppDb ve AuthDb aynı PostgreSQL instance — production'da ayrılmalı |
| HTTPS | Mobil dev'de HTTP kullanılıyor — production'da HTTPS zorunlu |
| Secret Key | Dev config'de düz metin JWT secret — secrets manager'a taşınmalı |

### 8.3 Güvenlik Notları

- `MapInboundClaims = false` ✅ — `sub` claim doğru işleniyor
- IDOR koruması `ClientIdentityResolver` ile ✅
- Premium doğrulama sunucu taraflı ✅ — JWT'ye güvenilmiyor
- Rate limiting tüm hassas endpoint'lerde ✅
- `usesCleartextTraffic: true` Android'de — sadece dev build'de ✅

---

## 9. Sonraki Adımlar

### Kısa Vadeli (0-2 Hafta)

```
[ ] Mobile: MessagesScreen'i implement et veya kaldır
[ ] Mobile: TodayScreen'i PlansScreen'den ayır (opsiyonel)
[ ] Web Panel: Tüm dashboard sayfalarını uçtan uca test et
[ ] Backend: Legacy DietPlan tablolarını temizle (migration)
[ ] Dev: adb reverse'i otomatik çalıştıran script ekle
```

### Orta Vadeli (2-6 Hafta)

```
[ ] Production hazırlığı:
    - CORS origin'lerini güncelle
    - JWT expiry'yi kısalt (örn. 60 dakika + refresh token)
    - Secrets Manager entegrasyonu
    - HTTPS sertifikası (production)
[ ] LLM malzeme normalizasyonunu etkinleştir (OpenAI API key ile)
[ ] Push notification altyapısı (mesajlaşma için)
[ ] App Store / Play Store build pipeline
```

### Uzun Vadeli

```
[ ] AuthDb ve AppDb'yi ayrı PostgreSQL instance'larına taşı
[ ] CI/CD pipeline (GitHub Actions)
[ ] Monitoring (Sentry, Datadog, vs.)
[ ] E2E test (Detox / Playwright)
```

---

## 10. Referans: Tüm Endpoint Listesi

### Public (Auth gerekmez)

```
GET  /health
GET  /debug/build         (dev only)
GET  /debug/endpoints     (dev only)
POST /api/auth/client/register
POST /api/auth/client/login
POST /api/auth/dietitian/register
POST /api/auth/dietitian/login
GET  /api/public/recipes
```

### Client (JWT: role=Client)

```
GET  /api/client/me
GET  /api/client/dashboard              (premium)
GET  /api/diet-plans/today              (premium)
POST /api/client/meals/{id}/complete    (premium)
DEL  /api/client/meals/{id}/complete    (premium)
POST /api/client/activate-premium
GET  /api/client/branding
GET  /api/client/dietitian-info
GET  /api/client/notes
GET  /api/client/compliance
POST /api/client/weight
GET  /api/client/weight
POST /api/client/measurements
GET  /api/client/measurements
GET  /api/ingredients/search?q=
GET  /api/ingredients/packs
POST /api/alternative/decide
POST /api/recipes/match
POST /api/client/kitchen/merge
```

### Dietitian (JWT: role=Dietitian)

```
GET  /api/dietitian/clients
GET  /api/dietitian/clients/{id}
POST /api/dietitian/clients/{id}/bind
GET  /api/dietitian/plans
POST /api/dietitian/plans
GET  /api/dietitian/daily-plans
POST /api/dietitian/daily-plans
GET  /api/dietitian/recipes
POST /api/dietitian/recipes
PUT  /api/dietitian/recipes/{id}
DEL  /api/dietitian/recipes/{id}
GET  /api/dietitian/settings
PUT  /api/dietitian/settings
GET  /api/dietitian/branding
PUT  /api/dietitian/branding
POST /api/dietitian/settings/logo
GET  /api/dietitian/clients/{id}/analytics
GET  /api/dietitian/retention
GET  /api/dietitian/notes/{clientId}
POST /api/dietitian/notes/{clientId}
GET  /api/dietitian/access-keys
POST /api/dietitian/access-keys
```

### Admin (JWT: role=Admin)

```
GET  /api/admin/dietitians
POST /api/admin/dietitians
GET  /api/ingredients
POST /api/ingredients
PUT  /api/ingredients/{id}
POST /api/ingredients/{id}/toggle-active
```

---

## Versiyon Geçmişi (Son 5 Commit)

| Hash | Açıklama |
|---|---|
| `be04f7b` | Malzeme normalizasyonu: runtime arama + fuzzy + LLM + taksonomi |
| `49956c5` | Web panel tam implementasyon |
| `a139a0f` | Web panel API entegrasyonu tamamlandı |
| `8bfb5f6` | Backend freeze — API cleanup |
| `b3ebebf` | EPIC E/F modülleri, migration'lar, Swagger düzeltmeleri |

---

*Bu doküman `2026-03-23` tarihinde `chore/backend-freeze-final` branch'ındaki gerçek kod analiz edilerek oluşturulmuştur.*
