# Cloudflare Tunnel Setup — MyDietitian Mobile App

Cloudflare Tunnel, local backend'ini herhangi bir ağdan HTTPS üzerinden erişilebilir kılar.  
Aynı Wi-Fi'da olma zorunluluğunu ortadan kaldırır.

---

## Gereksinimler

- `cloudflared` kurulu olmalı  
  İndir: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
- Backend çalışıyor olmalı (port 5000)

---

## Her Oturum İçin Adımlar

### 1. Backend'i Başlat

```cmd
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api
dotnet run --launch-profile http
```

### 2. Yeni CMD Aç — Tunnel Başlat

```cmd
cloudflared tunnel --url http://localhost:5000
```

Çıktıda şuna benzer bir URL görürsün:

```
https://bright-sky-lab.trycloudflare.com
```

> Quick Tunnel URL'leri geçicidir. Her `cloudflared` başlatmasında değişebilir.

### 3. URL'yi eas.json'a Yapıştır

`mobile-app/eas.json` dosyasını aç:

```json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_BASE_URL": "https://BURAYA_TUNNEL_URLNI_YAZ.trycloudflare.com",
    "EXPO_PUBLIC_API_BASE_URL_FORCE": "1",
    "EXPO_PUBLIC_API_TIMEOUT_MS": "15000"
  }
}
```

`https://YOUR_TUNNEL_URL.trycloudflare.com` satırını gerçek URL ile değiştir.

### 4. Preview APK Build Al

```cmd
cd C:\Users\hy971\source\repos\MyDietitianMobileApp\mobile-app
eas build -p android --profile preview
```

---

## Lokal Dev (Metro) İçin

`mobile-app/.env` dosyasını oluştur (`.env.example`'dan kopyala):

```env
EXPO_PUBLIC_API_BASE_URL_FORCE=1
EXPO_PUBLIC_API_BASE_URL=https://YOUR_TUNNEL_URL.trycloudflare.com
```

Metro'yu yeniden başlat:

```cmd
npx expo start --clear
```

---

## URL Değiştiğinde Ne Yapmalı

Quick Tunnel her başlatmada yeni URL verebilir. URL değişirse:

1. `eas.json` → `preview.env.EXPO_PUBLIC_API_BASE_URL` güncelle
2. `eas build -p android --profile preview` ile yeni APK al

> Kalıcı URL için Cloudflare'de **Named Tunnel** + özel subdomain kurulabilir.

---

## Tek Güncelleme Noktası

| Durum | Dosya | Alan |
|-------|-------|------|
| EAS cloud APK build | `eas.json` | `build.preview.env.EXPO_PUBLIC_API_BASE_URL` |
| Local Metro dev | `.env` | `EXPO_PUBLIC_API_BASE_URL` |

Her iki yerde aynı tunnel URL kullanılır. Başka dosyada IP/URL yoktur.

---

## Nasıl Çalışır

```
Telefon (herhangi ağ)
    ↓ HTTPS
Cloudflare Edge
    ↓ Tunnel (şifreli)
cloudflared process (PC'nde)
    ↓ http://localhost:5000
ASP.NET Core Backend (PC'nde)
```

Backend asla doğrudan internete açılmaz. Cloudflare bağlantıyı proxy'ler.
