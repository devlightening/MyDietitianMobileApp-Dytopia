# MyDietitianMobileApp – Cloudflare Tunnel Only Plan

## Amaç

Bu doküman sadece **Cloudflare Tunnel** kurulumunu ve MyDietitian mobile app'in local IP bağımlılığından çıkarılıp **HTTPS tunnel URL** ile test edilmesini kapsar.

Bu plan, Android APK build'i artık başarıyla alındıktan sonra uygulanmalıdır.

---

## Ne Kazandırır?

Cloudflare Tunnel ile:

- telefon ve laptop aynı Wi-Fi'da olmak zorunda kalmaz
- local IP değişse bile test akışı bozulmaz
- fiziksel cihazda farklı ağlardan test mümkün olur
- backend localde çalışmaya devam eder ama dışarıdan güvenli HTTPS URL ile erişilir

---

## Önemli Not

Cloudflare Tunnel:
- **network erişim sorununu çözer**
- **Android build / Gradle / dependency sorunlarını çözmez**

Bu yüzden bu plan yalnızca build başarıyla alındıktan sonra uygulanmalıdır.

---

## Aşama 1 – Kullanıcının Manuel Yapacakları

### 1. Cloudflared indir
Resmi indirme sayfasından Windows sürümünü indir:

- Cloudflared downloads (official): https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/

İstersen genel Cloudflare Tunnel docs:
- Cloudflare Tunnel overview: https://developers.cloudflare.com/tunnel/

### 2. Backend'i aç
Yeni CMD aç:

```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api
dotnet run --launch-profile http
```

Backend'in 5000 portunda çalıştığını doğrula.

### 3. Yeni terminal aç ve tunnel başlat
```bat
cloudflared tunnel --url http://localhost:5000
```

### 4. Çıkan HTTPS URL'yi kopyala
Örnek:
```text
https://bright-sky-lab.trycloudflare.com
```

Bu URL, mobil uygulamanın bağlanacağı geçici HTTPS backend adresin olacak.

### 5. Browser testi yap
Telefon ya da PC browser'da çıkan tunnel URL'yi aç.
Backend cevap veriyorsa tunnel çalışıyordur.

---

## Aşama 2 – Claude Code'dan İstenecekler

Claude Code'a sadece bu kapsamı ver:

### Hedef
MyDietitian mobile app artık local LAN IP kullanmasın.

Örnek eski yapı:
```text
http://172.20.10.3:5000
```

Örnek yeni yapı:
```text
https://bright-sky-lab.trycloudflare.com
```

### Claude'un yapması gerekenler
1. API config'i merkezi yapıda koru
2. Hard-coded local IP kalıntılarını kaldır
3. `EXPO_PUBLIC_API_BASE_URL` yapısını tunnel URL ile uyumlu kullan
4. `eas.json`, `app.config.ts`, `src/config/api.ts`, `src/api/client.ts` ve bağlı network katmanlarını gözden geçir
5. Tunnel URL değiştiğinde tek noktadan güncellenebilir yapı bırak
6. `mobile-app/docs/CLOUDFLARE_TUNNEL_SETUP.md` dosyası oluştur
7. EAS projectId ve mevcut auth / premium / plan akışlarını bozma

---

## Claude Code Prompt

Aşağıdaki prompt'u Claude Code'a ver:

```text
The Android APK build is already working.

Now apply ONLY the Cloudflare Tunnel integration phase for MyDietitianMobileApp mobile app.

Goal:
Remove local LAN IP dependency and make the app ready to use a Cloudflare Tunnel HTTPS URL.

Current bad example:
http://172.20.10.3:5000

Target example:
https://example.trycloudflare.com

Requirements:
1. Keep API config centralized
2. Preserve existing auth, premium activation, profile, plans, kitchen and other flows
3. Preserve current EAS projectId and build flow
4. Remove hard-coded local IP remnants
5. Make preview builds configurable via EXPO_PUBLIC_API_BASE_URL
6. Do not revisit Android build fixes unless absolutely necessary
7. Create:
   mobile-app/docs/CLOUDFLARE_TUNNEL_SETUP.md

Check and update as needed:
- mobile-app/eas.json
- mobile-app/app.config.ts
- mobile-app/src/config/api.ts
- mobile-app/src/api/client.ts
- any other network client or route config file

The user will manually run:
cloudflared tunnel --url http://localhost:5000

The user will manually copy the generated HTTPS URL.

Prepare the project so this URL can be plugged in cleanly and then used in a new preview APK build.

Also provide concise Turkish summary and exact Windows CMD commands for:
- backend run
- cloudflared run
- new APK build
- where to place the new tunnel URL
```

---

## Aşama 3 – Kullanıcının Sonraki Adımları

Claude Code gerekli dosyaları düzenledikten sonra:

### 1. Backend'i aç
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api
dotnet run --launch-profile http
```

### 2. Tunnel başlat
```bat
cloudflared tunnel --url http://localhost:5000
```

### 3. Çıkan HTTPS URL'yi al
Örnek:
```text
https://bright-sky-lab.trycloudflare.com
```

### 4. Bu URL'yi Claude'un hazırladığı config noktasına yaz
Büyük ihtimalle:
- `mobile-app/eas.json`
veya
- `.env`
veya
- runtime config dosyası

### 5. Yeni APK build al
```bat
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\mobile-app
eas build -p android --profile preview
```

### 6. APK'yı telefona kur
Bu aşamadan sonra artık aynı Wi-Fi bağımlılığı kalkmış olur.

---

## Önemli Gerçek

Quick Tunnel URL'leri geçici olabilir.
Bu yüzden:

- yeni tunnel açarsan yeni URL gelebilir
- URL değişirse config güncellemesi gerekebilir
- çoğu durumda yeni preview APK build almak gerekir

Daha kalıcı yapı için daha sonra:
- named tunnel
- sabit subdomain
- hatta deploy edilmiş backend

düşünülebilir.

---

## Kısa Özet

Şu sırayla ilerle:

1. Cloudflared indir
2. Backend'i çalıştır
3. `cloudflared tunnel --url http://localhost:5000` çalıştır
4. çıkan HTTPS URL'yi al
5. Claude Code'a bu planı ver
6. Claude config'i tunnel-ready hale getirsin
7. yeni preview APK build al
