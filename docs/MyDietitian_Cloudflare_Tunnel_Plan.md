# MyDietitianMobileApp – Build Fix + Cloudflare Tunnel Geçiş Planı

## Amaç

Bu dokümanın amacı iki aşamalı bir geçiş planı tanımlamaktır:

1. **Önce Android EAS build hatalarını kalıcı olarak düzeltmek**
2. **Sonra local IP bağımlılığını kaldırıp Cloudflare Tunnel ile sabit HTTPS test URL yapısına geçmek**

> Öncelik sırası kritiktir. APK başarıyla üretilmeden Cloudflare Tunnel geçişi anlamlı olmaz.

---

## Mevcut Durum Özeti

Projede şu tip problemler görüldü:

- EAS Android build sırasında Gradle hata veriyor
- Native dependency resolution / linking problemi yaşandı
- Android package/applicationId tarafında eski/yanlış kimlik kalıntıları vardı
- `expo doctor` tarafında config ve dependency uyarıları çıktı
- `expo-font` sürümü yanlış seçildiği için `npm install` patladı
- Mobil app şu an local IP tabanlı backend URL kullanıyor, bu da:
  - aynı Wi-Fi zorunluluğu oluşturuyor
  - IP değişince yeniden config/build ihtiyacı doğuruyor

---

# AŞAMA 1 — Android Build Hatalarını Düzeltme

## Hedef

Aşağıdaki komutun başarılı olması:

```bash
eas build -p android --profile preview
```

## Root Cause Özeti

Şu ana kadar görülen ana sorunlar:

1. **Android native identity mismatch**
   - `com.anonymous.mobileapp` gibi eski package/namespace kalıntıları
   - doğru kimlik: `com.mydietitian.mobileapp`

2. **Expo config schema sorunu**
   - `android.usesCleartextTraffic` Expo config şemasında yanlış yerdeydi

3. **Dependency sürüm uyumsuzluğu**
   - özellikle `expo-font`
   - `@expo/vector-icons` ile peer dependency çakışması

4. **Expo / native dependency hizasızlığı**
   - `react-native-worklets`
   - Expo SDK 54 ile sürüm uyumu

---

## Claude Code’dan İstenecekler

Claude Code’a şu görevler verilmeli:

### 1. Native Android kimliğini doğrula ve düzelt
Kontrol edilecek yerler:

- `mobile-app/android/app/build.gradle`
- `mobile-app/android/app/src/main/AndroidManifest.xml`
- `mobile-app/android/app/src/main/java/...`
- `mobile-app/android/app/src/main/kotlin/...`
- `mobile-app/android/settings.gradle`
- `mobile-app/android/gradle.properties`

Beklenen sonuç:

- `namespace = "com.mydietitian.mobileapp"`
- `applicationId = "com.mydietitian.mobileapp"`
- Kotlin/Java package path referansları doğru olsun
- eski `com.anonymous.mobileapp` kalıntısı kalmasın

---

### 2. Expo config schema hatasını düzelt
Kontrol edilecek yerler:

- `mobile-app/app.json`
- `mobile-app/app.config.ts`

Beklenen sonuç:

- Expo config içinde geçersiz `android.usesCleartextTraffic` tanımı kaldırılmalı
- Eğer cleartext trafik gerçekten gerekiyorsa, bu Android manifest seviyesinde doğru yöntemle uygulanmalı
- mevcut `extra.eas.projectId` korunmalı
- mevcut API base URL env yapısı bozulmamalı

---

### 3. Dependency tree’yi düzelt
Özellikle şunları temizle:

- yanlış `expo-font` sürümü
- `@expo/vector-icons` peer dependency uyumu
- Expo SDK 54 ile uyumsuz sürümler
- `react-native-worklets` Expo SDK 54 ile hizalı olmalı
- duplicate native dependency kalmamalı

Beklenen sonuç:

- `npm install` hata vermeden çalışmalı
- `npx expo install --check` mantıksal olarak temiz sonuç vermeli
- `expo doctor` içindeki build-blocking sorunlar kapanmalı

---

### 4. Android/autolinking kalıntılarını temizle
Aşağıdakileri incele:

- `react-native.config.js` varsa
- eski manual linking kalıntıları
- `settings.gradle` içine elle yazılmış project include’ları
- `app/build.gradle` içindeki eski native module referansları
- Expo autolinking ile çakışan custom wiring

Beklenen sonuç:

- `react-native-community_datetimepicker`
- `react-native-reanimated`
- `react-native-safe-area-context`
- `react-native-screens`
- `react-native-worklets`

için “No matching variant / No variants exist” hatası ortadan kalkmalı

---

## Kullanıcının Uygulayacağı Windows CMD Komutları

> Not: Bunları Claude Code değişiklikleri uygulandıktan sonra çalıştır.

### 1. Proje klasörüne geç
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\mobile-app
```

### 2. Yanlış expo-font varsa kaldır
```bat
npm uninstall expo-font
```

### 3. Temiz kurulum için eski bağımlılıkları sil
```bat
rmdir /s /q node_modules
del package-lock.json
```

İstersen Android cache temizliği de yap:

```bat
rmdir /s /q android\build
rmdir /s /q android\.gradle
```

### 4. Expo SDK uyumlu expo-font kur
```bat
npx expo install expo-font
```

### 5. Paketleri yeniden kur
```bat
npm install
```

### 6. Gerekirse Expo prebuild temiz üret
> Claude Code özellikle önerirse çalıştır:

```bat
npx expo prebuild --clean
```

### 7. Tekrar EAS build al
```bat
eas build -p android --profile preview
```

---

## AŞAMA 1 Kabul Kriterleri

Aşağıdakiler sağlanmadan AŞAMA 2’ye geçilmemeli:

- `npm install` sorunsuz çalışıyor
- `expo doctor` içindeki build-blocking hatalar temizlenmiş
- `eas build -p android --profile preview` başarılı
- APK indirme linki oluşuyor

---

# AŞAMA 2 — Cloudflare Tunnel ile Sabit HTTPS Test URL

## Amaç

Mobil uygulamanın local IP’ye bağlı çalışmasını bırakmak.

Mevcut kötü senaryo:

```text
http://172.20.10.3:5000
```

Bu yaklaşımın sorunları:
- aynı Wi-Fi zorunluluğu
- IP değişirse app bozulur
- yeni IP için config güncelleme gerekir
- çoğu zaman yeniden build gerektirir

Hedef yaklaşım:

```text
https://<your-tunnel-subdomain>.trycloudflare.com
```

veya daha sonra kalıcı bir subdomain:

```text
https://api-test.yourdomain.com
```

---

## Cloudflare Tunnel Ne Kazandırır?

- aynı Wi-Fi şartını kaldırır
- local IP değişse bile etkilenmez
- fiziksel cihazlarda farklı ağlardan test mümkün olur
- telefon mobil veri ile bile backend’e erişebilir
- build sonrası test akışı çok daha rahat olur

---

## Önemli Not

Cloudflare Tunnel:

- **network erişim sorununu çözer**
- **build/dependency/native Android hatalarını çözmez**

Bu yüzden önce AŞAMA 1 bitmelidir.

---

## Hızlı Başlangıç: Quick Tunnel

### Kullanıcının Yapacakları

#### 1. Cloudflared kur
Windows için Cloudflare `cloudflared` binary’sini indir ve kur.

#### 2. Backend’i çalıştır
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api
dotnet run --launch-profile http
```

#### 3. Cloudflare Tunnel başlat
Yeni terminal aç ve çalıştır:

```bat
cloudflared tunnel --url http://localhost:5000
```

#### 4. Çıkan HTTPS URL’yi kopyala
Örnek:

```text
https://bright-sky-lab.trycloudflare.com
```

> Bu URL test backend adresin olacak.

---

## Claude Code’dan İstenecekler — Cloudflare Tunnel Geçişi

Claude Code aşağıdakileri yapmalı:

### 1. API base URL yapısını local IP’den çıkar
Kontrol edilecek yerler:

- `mobile-app/eas.json`
- `mobile-app/app.config.ts`
- `mobile-app/src/config/api.ts`
- `mobile-app/src/api/client.ts`
- auth / profile / plan / alternative / route dosyaları

Beklenen sonuç:

- merkezi API config korunmalı
- hard-coded local IP kalmamalı
- `EXPO_PUBLIC_API_BASE_URL` üzerinden yönetilmeli
- tunnel URL girildiğinde uygulama doğrudan ona bağlanmalı

---

### 2. Preview profile’ı tunnel URL ile çalışacak hale getir
Örnek hedef:

```json
"EXPO_PUBLIC_API_BASE_URL": "https://bright-sky-lab.trycloudflare.com"
```

Beklenen sonuç:

- preview APK build bu URL’yi kullanmalı
- local network IP mantığı ortadan kalkmalı

---

### 3. Dokümantasyon oluştur
Claude Code şu dosyayı oluşturmalı:

```text
mobile-app/docs/CLOUDFLARE_TUNNEL_SETUP.md
```

İçinde şunlar olmalı:

- Cloudflare Tunnel nedir
- Kullanıcı ne kuracak
- Backend hangi komutla açılacak
- Tunnel hangi komutla çalışacak
- Tunnel URL nereye yazılacak
- EAS build komutu ne olacak
- APK aynı Wi-Fi olmadan nasıl test edilecek
- Tunnel kapanırsa ne olur
- Yeni tunnel URL çıkarsa ne güncellenmeli

---

## Kullanıcının Uygulayacağı Adımlar — Cloudflare Tunnel Sonrası

### 1. Backend’i aç
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api
dotnet run --launch-profile http
```

### 2. Tunnel başlat
```bat
cloudflared tunnel --url http://localhost:5000
```

### 3. Çıkan HTTPS URL’yi al
Örnek:

```text
https://bright-sky-lab.trycloudflare.com
```

### 4. Bu URL’yi Claude Code’un ayarladığı config noktasına yaz
Büyük ihtimalle:

- `mobile-app/eas.json`
veya
- `.env`
veya
- runtime config dosyası

hangi yapı seçildiyse oraya.

### 5. Yeni APK build al
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\mobile-app
eas build -p android --profile preview
```

### 6. APK’yı telefona kur
Bu aşamadan sonra:
- telefon ve laptop aynı Wi-Fi’da olmak zorunda olmayacak
- tunnel açık olduğu sürece backend erişilebilir olacak

---

## Cloudflare Tunnel Kullanırken Bilmen Gerekenler

### Quick Tunnel geçici olabilir
Yani her açılışta yeni URL verebilir.

Bu durumda:
- yeni URL’yi config’e yazman gerekir
- çoğu durumda yeni build alman gerekir

### Daha iyi çözüm: named tunnel
Sonraki aşamada:
- Cloudflare hesabı ile login
- kalıcı tunnel
- sabit subdomain

kurulabilir.

Bu, daha profesyonel test akışı sağlar.

---

# Claude Code İçin Hazır Görev Metni

Aşağıdaki metni Claude Code’a ver:

```text
We have two goals for MyDietitianMobileApp mobile app:

PHASE 1
Fix Android EAS build issues completely.
Current known issues include:
- wrong Android native package identity remnants
- Expo config schema issue with android.usesCleartextTraffic
- expo-font / @expo/vector-icons dependency conflict
- Expo SDK 54 dependency alignment
- possible stale autolinking/manual native wiring

You must directly modify project files and leave the project in a buildable state for:
eas build -p android --profile preview

PHASE 2
Prepare the app to use Cloudflare Tunnel instead of local LAN IPs.
The app must no longer depend on addresses like:
http://172.20.10.3:5000

Instead, it should be ready to use a tunnel URL like:
https://example.trycloudflare.com

Requirements:
1. Keep API config centralized
2. Preserve EAS projectId
3. Preserve existing auth / premium / plan flows
4. No hard-coded local IP should remain
5. Document the setup in:
   - mobile-app/docs/ANDROID_BUILD_FIX_REPORT.md
   - mobile-app/docs/CLOUDFLARE_TUNNEL_SETUP.md

For Cloudflare Tunnel:
- Assume backend runs locally on port 5000
- The user will start cloudflared manually
- The user will get a public HTTPS tunnel URL
- The app should be configurable to use that URL cleanly

Also provide exact Windows CMD commands for the user:
- clean install
- build
- backend run
- cloudflared run
- where to change the tunnel URL

Do not stop at analysis. Apply file changes directly and then give a concise Turkish summary.
```

---

# Son Hedef Mimari

## Bugün
- APK build alınabiliyor
- local IP ile çalışıyor

## Hemen sonra
- APK build alınabiliyor
- Cloudflare Quick Tunnel URL ile çalışıyor

## Sonraki seviye
- sabit named tunnel veya deploy edilmiş backend
- kalıcı domain
- minimum rebuild ihtiyacı

---

# Son Not

Bu planın doğru sırası şudur:

1. **Build fix**
2. **Cloudflare Tunnel entegrasyonu**
3. İstersen daha sonra:
   - named tunnel
   - sabit subdomain
   - gerçek backend deploy
