# MyDietitianMobileApp — Proje Durum Analizi
**Tarih:** 9 Nisan 2026  
**Branch:** `chore/backend-freeze-final`  
**Analiz Kapsamı:** Mobile App · Backend · Web Panel · Git · Kalite

---

## 1. Proje Yapısı

```
MyDietitianMobileApp/
├── mobile-app/              # React Native + Expo (Client)
├── src/                     # .NET 8 Backend (Clean Architecture)
│   ├── MyDietitianMobileApp.Api/
│   ├── MyDietitianMobileApp.Application/
│   ├── MyDietitianMobileApp.Domain/
│   ├── MyDietitianMobileApp.Infrastructure/
│   └── MyDietitianMobileApp.Shared/
├── web-panel/               # Next.js 14 (Diyetisyen Dashboard)
├── tests/                   # Backend Test Suite
└── docs/                    # Dokümantasyon
```

---

## 2. Mobil Uygulama

### Teknik Stack
| Alan | Versiyon |
|---|---|
| Expo SDK | ~54.0.31 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| TypeScript | ~5.9.2 (strict) |
| Navigation | React Navigation v7 |
| Data Fetching | React Query v5 |
| HTTP | Axios v1.13.2 |
| Auth Storage | expo-secure-store |

### Ekran Envanteri (22 Ekran)
**Auth Stack:** WelcomeScreen, LoginScreen, RegisterScreen  
**Free Stack:** FreeHomeScreen  
**Premium Stack (AppShell):** DashboardScreen, PlansScreen, KitchenScreen, MessagesScreen, ProfileScreen  
**Modal:** PremiumActivationScreen  
**Derinlik:** CheckIngredientsScreen, AlternativeResultScreen, KitchenResultScreen, RecipeDetailScreen, ProfileMeasurementsScreen, ProfileNotificationsScreen, ShoppingListScreen, GoalPreferencesScreen, PrivacyScreen, RateAppScreen, IngredientScanScreen

### Navigation Yapısı
```
RootNavigator
├── Auth Stack        → Welcome, Login, Register
├── Free Stack        → FreeHome
├── App Stack         → AppShell (5 tab) + Modal screens
└── Modal             → PremiumActivation
```

AppShell; dashboard / plans / kitchen / messages / profile tab'larını yönetir.  
Yatay kaydırma (gesture) desteği ve pantry sistemi dahil.

### API Modülleri (15 Adet)
`auth` · `client` · `client-state` · `diet-plans` · `alternative` · `kitchen` · `vision` · `gamification` · `pantry` · `shopping-list` · `preferences` · `profile` · `notification-preferences` · `care` · `health`

### Auth Flow
- Token: SecureStore (expo-secure-store)
- Tek doğrulama noktası: `/api/client/me` (sunucu)
- `isPremium` **mutlaka** sunucudan doğrulanır
- 401 → otomatik logout
- Offline mod desteği mevcut

### Tema Sistemi
- Light / Dark tema (ThemeContext)
- Token tabanlı: `tokens.ts` → `lightTheme`, `darkTheme`
- Spacing, radii, typography, shadows ayrı dosyalarda
- Primary renk: Emerald (`#47B972` light · `#61D288` dark)

### i18n
- Türkçe (`tr.ts`) + English (`en.ts`)
- SecureStore'da dil tercihi kalıcı
- Kapsam: tabs, auth, dashboard, kitchen, profile, compliance, premium, retention

### Eksik / Yarım Özellikler
| Özellik | Durum |
|---|---|
| Meal Plans UI | Ekran var, dashboard entegrasyonu eksik |
| Messages / Care Hub | Composer mevcut, diyetisyen yanıtı implement edilmedi |
| Gamification | Streak rail var, aggregation pending |
| Vision / Kamera | IngredientScanScreen var, LLM disabled |
| Shopping List | API var, UI formu eksik |
| Measurements History | Giriş formu çalışıyor, geçmiş görünümü eksik |

---

## 3. Backend (.NET 8)

### Mimari — Clean Architecture (4 Katman)
| Katman | İçerik |
|---|---|
| **Api** | 40 controller, GlobalException middleware, ProblemDetails |
| **Application** | 26 CQRS handler (Query / Command) |
| **Domain** | 51 entity, business logic, interfaces |
| **Infrastructure** | EF Core, 18 migration, servisler |

### Controller Kategorileri
| Grup | Adet |
|---|---|
| Auth | 2 |
| Client | 10 |
| Dietitian | 8 |
| Recipe | 2 |
| Admin, Health, Kitchen, Ingredient, Alternative, Retention, Dashboard, Benchmark | 8 |

### Database
- **Son Migration:** `20260409080555_AddGamificationEngine`
- **Bir önceki:** `20260408141157_AddCareHubClientOps`
- **Ana Tablolar (20+):** Clients, Dietitians, DietitianClientLinks, Ingredients, IngredientFamilies, Recipes, ClientMealPlans, MealPlanDays, ClientGamificationSnapshots, ClientCareMessages, ClientProgressEntries, AccessKeys, ComplianceScoreConfigs…
- **Auth DB:** ASP.NET Identity — `PublicUserId` field eklendi

### Önemli Servisler
- `IngredientNormalizationService` — 3 katman: canonical → fuzzy (%55 threshold) → LLM (gpt-4o-mini)
- `AlternativeMealDecisionService` — Alternatif öneri motoru
- `RecipeRecommendationEngine` — Kural tabanlı tarif önerisi
- `TaxonomySeeder` — Ingredient family seed verisi

### Rate Limiting Politikaları
`auth-write` · `progress-write` · `telemetry-write` · `dietitian-read-heavy`

### Tespit Edilen TODO'lar
```
AdminController                → Add limits fields to Dietitian entity
DietitianManagementController  → Activity tracking, compliance calculation, current meal
DietitianPlanController        → Compliance calculation (atRisk flag)
DietitianRecipesController     → Tag filtering, createdAt timestamp, image URL, nutrition data
RetentionController            → Email/push notification provider integration
AlternativeMealDecisionService → Nutritional comparison logic
```

### Hardcoded / Risk Değerleri
| Değer | Risk |
|---|---|
| `"CHANGE_ME_LOCKOUT_SECRET"` | **Production öncesi mutlaka değiştirilmeli** |
| Allowed email domains | Sabit liste (gmail, outlook, hotmail, live, icloud, yahoo) |
| LLM / Vision | Disabled — `OPENAI_API_KEY` env var gerekli |
| Dev port | 5000 (HTTP) · 7154 (HTTPS) |

---

## 4. Web Panel (Next.js 14)

### Stack
| Alan | Versiyon |
|---|---|
| Next.js | 14.2.35 (App Router) |
| React | 18.2.0 |
| TypeScript | 5.3.3 (strict) |
| Styling | Tailwind CSS 3.4.1 |
| UI | shadcn/ui + Headless UI |
| i18n | next-intl 4.7.0 (TR/EN) |
| Forms | React Hook Form + Zod |
| HTTP | Axios + React Query 4.x |
| Theme | next-themes (Dark mode) |
| E2E Test | Playwright |

### Sayfa Envanteri
| Yol | İşlev |
|---|---|
| `/login` | Diyetisyen girişi |
| `/dashboard` | Genel analitik |
| `/dashboard/clients` | İstemci listesi |
| `/dashboard/clients/[id]` | İstemci detayı |
| `/dashboard/diet-plans` | Meal plan listesi |
| `/dashboard/diet-plans/create` | Yeni plan oluştur |
| `/dashboard/recipes` | Tarif yönetimi |
| `/dashboard/recipe-match` | Tarif eşleştirme simülasyonu |
| `/dashboard/access-keys` | Premium key üretimi |
| `/dashboard/branding` | Diyetisyen branding ayarları |
| `/dashboard/care-hub` | Mesajlaşma |
| `/dashboard/retention` | Retansiyon araçları |
| `/dashboard/settings` | Profil / sistem ayarları |

---

## 5. Git Durumu

**Branch:** `chore/backend-freeze-final`

### Son 8 Commit
| Hash | Mesaj |
|---|---|
| `be04f7b` | feat(ingredient-normalization): Runtime search, fuzzy, LLM fallback, taxonomy seed |
| `49956c5` | feat: Web panel complete implementation |
| `a139a0f` | feat: Web panel API integration complete |
| `8bfb5f6` | chore: Backend freeze — API cleanup |
| `b3ebebf` | feat(backend): EPIC E/F — gamification, care hub, dietitian reporting, Swagger fix |
| `b4088b4` | feat(meal-plans): Core schema, dashboard hardening, retries, debug endpoints |
| `020f411` | fix(mobile): Auth routing, free-first flow, premium activation, bearer tokens |
| `4ffeae7` | fix(auth): Cookie-based JWT, claim alignment, HTTPS |

**Working Directory:** ~150+ modified file (büyük çoğunluğu CRLF→LF line-ending farkı)  
**Silinmiş Dökümanlar:** `API_INVENTORY.md`, `BACKEND_WORKLOG.md`, `MOBILE_AUTH_SETUP.md` dahil 8 dosya

---

## 6. Kalite Değerlendirmesi

### Güçlü Yönler ✅
- Backend Clean Architecture doğru uygulanmış
- CQRS pattern eksiksiz implement edilmiş
- IDOR koruması (DietitianClientLink + tenant isolation testleri)
- Auth flow server-side doğrulama (client-side bypass yok)
- TypeScript strict mode her üç projede aktif
- 26+ unit / integration test
- Theme sistemi merkezi ve tutarlı (token based)
- i18n iki dil tam kapsam

### Dikkat Gerektiren Alanlar ⚠️
- 8× `catch (error: any)` — typed error handling eksik
- `CHANGE_ME_LOCKOUT_SECRET` — production deployment öncesi kritik
- Silinmiş 8 döküman dosyası — API envanteri güncel değil
- Working directory'de commit edilmemiş 150+ değişiklik

---

## 7. Tamamlanma Özeti

| Modül | Durum | Tahmini % |
|---|---|---|
| Backend Core | ✅ Tamamlandı | 95% |
| Database Schema | ✅ Tamamlandı | 100% |
| Auth Sistemi | ✅ Tamamlandı | 100% |
| API Controllers | ✅ Büyük ölçüde | 90% |
| Web Panel | ✅ Büyük ölçüde | 85% |
| Mobile UI | ⚠️ Kısmi | 75% |
| Mobile–Backend Entegrasyonu | ⚠️ Kısmi | 70% |
| Meal Plans | ⚠️ Kısmi | 60% |
| Gamification | ⚠️ Kısmi | 65% |
| Shopping List | ⚠️ Kısmi | 50% |
| Test Kapsamı | ✅ İyi | 70% |
| Dokümantasyon | ❌ Yetersiz | 20% |

---

## 8. Genel Değerlendirme

Proje **advanced prototype / beta** aşamasındadır. Temel mimari (backend, auth, DB schema, web panel) sağlam ve production kalitesine yakın. Eksikler UI entegrasyon detaylarında ve bazı workflow'ların tamamlanmasında yoğunlaşıyor.

**Production'a geçiş için kritik adımlar:**
1. `CHANGE_ME_LOCKOUT_SECRET` → gerçek secret ile değiştir
2. `OPENAI_API_KEY` env var → LLM/vision aktif et (isteğe bağlı)
3. Mobile–backend entegrasyon testleri (meal plans, gamification, care hub)
4. Working directory commit edilmemiş değişiklikleri temizle
5. Cleartext traffic (Android) → production'da kapat
