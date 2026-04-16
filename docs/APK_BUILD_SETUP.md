# Android APK Build — Device Test Rehberi

## 1. API base URL nerede değişir

**EAS cloud build için** → `mobile-app/eas.json` dosyasını aç:

```json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_BASE_URL": "http://10.60.216.101:5000",   ← buraya PC'nin LAN IP'sini yaz
    "EXPO_PUBLIC_API_BASE_URL_FORCE": "1"
  }
}
```

Dosyayı kaydet, build al. Başka bir şey değiştirmene gerek yok.

---

## 2. Gerçek cihaz testi için hangi URL kullanılmalı

Fiziksel cihaz **localhost / 127.0.0.1 kullanamaz** — bu cihazın kendi loopback'idir.

Bilgisayarının yerel ağ IP'sini bul:
```
Windows : ipconfig      → "IPv4 Address" altındaki adres (10.60.216.101)
Mac/Linux: ifconfig / ip addr
```

Örnek: `http://10.60.216.101:5000`

### Backend'i ağdan erişilebilir hale getir

ASP.NET backend'in sadece localhost'a değil, tüm ağ arayüzlerine dinlemesi gerekiyor.
`launchSettings.json` ya da doğrudan komutla:

```bash
dotnet run --urls "http://0.0.0.0:5000"
```

veya `Properties/launchSettings.json` içinde:
```json
"applicationUrl": "http://0.0.0.0:5000"
```

**Windows Firewall:** 5000 portuna gelen TCP bağlantılarına izin ver.
```
Windows Defender Firewall → Inbound Rules → New Rule → Port → TCP 5000 → Allow
```

---

## 3. EAS login ve ilk kurulum

```bash
# EAS CLI'yi kur (bir kez)
npm install -g eas-cli

# Expo hesabına giriş yap
eas login

# Projeyi EAS'e bağla (bir kez — expo.dev üzerinde proje oluşturur)
cd mobile-app
eas build:configure
```

---

## 4. APK build alma komutu

```bash
# mobile-app klasöründe çalıştır
cd mobile-app

# eas.json preview.env.EXPO_PUBLIC_API_BASE_URL'i PC'nin LAN IP'sine ayarladıktan sonra:
eas build -p android --profile preview
```

Build tamamlandığında EAS sana bir **indirme linki** verir (expo.dev üzerinde de görünür).

---

## 5. APK'yı cihaza yükleme

- Build bitince terminalde çıkan URL'i aç → `.apk` dosyasını indir
- Cihaza USB ile aktar veya Google Drive/WhatsApp ile gönder
- Android'de "Bilinmeyen kaynaklardan yükleme"ye izin ver:
  `Ayarlar → Uygulamalar → Özel uygulama erişimi → Bilinmeyen uygulamaları yükle`
- APK'ya dokun → Yükle

---

## 6. Sık karşılaşılan hatalar

| Hata | Neden | Çözüm |
|------|-------|-------|
| `Network Error` / bağlanamıyor | URL yanlış ya da backend dinlemiyor | `eas.json`'daki IP'yi kontrol et, `dotnet run --urls http://0.0.0.0:5000` kullan |
| `ERR_CLEARTEXT_NOT_PERMITTED` | HTTP'ye izin verilmemiş | `app.json`'da `android.usesCleartextTraffic: true` zaten var ✓ |
| `Connection refused` | Firewall bloke ediyor | 5000 portuna Windows Firewall'dan izin ver |
| `localhost` çalışmıyor cihazda | Loopback cihazın kendisi | `eas.json`'da gerçek LAN IP kullan |
| Token / login sorunu | API URL farklı ortamlar arasında uyumsuz | APK ve backend aynı IP:PORT çiftini kullanmalı |

---

## 7. Özet — hızlı başlangıç

```bash
# 1. PC IP'ni öğren
ipconfig   # Windows

# 2. eas.json'daki URL'i güncelle
#    "EXPO_PUBLIC_API_BASE_URL": "http://192.168.X.X:5000"

# 3. Backend'i ağa aç
dotnet run --urls "http://0.0.0.0:5000"

# 4. Build al
cd mobile-app
eas build -p android --profile preview

# 5. İndir, cihaza yükle, test et
```
