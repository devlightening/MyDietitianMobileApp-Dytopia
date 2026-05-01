# Mobil Demo ve Smoke Kontrol Notları

Bu dosya, son eklenen Planım, Dolabım, Mutfak, Alışveriş, Rozet ve Bildirim dokunuşlarını hızlıca test etmek için kısa bir demo akışı sunar.

## Ön Hazırlık

- Backend ayakta olmalı ve `/health` `healthy` dönmeli.
- Mobil `.env` içindeki `EXPO_PUBLIC_API_BASE_URL` telefondan erişilebilen IPv4 adresini göstermeli.
- Test danışanı premium ve aktif diyetisyen bağlantılı olmalı.
- Dolabımda birkaç ürün bulunmalı; alışveriş listesi üretimini görmek için bazı tarif malzemeleri dolapta, bazıları eksik kalmalı.

## Demo Akışı

1. Ana sayfayı aç.
2. `Bugün küçük karar` kartının doğru yönlendirme verdiğini kontrol et.
3. Planım ekranına gir.
4. Saati gelmemiş bir öğünde `Alternatif Seç` aksiyonunu aç.
5. Alternatif carousel içinde sağa sola kaydır; arka planda tab değişmemeli.
6. Alternatif seç; öğün tamamlanmadan Bekleyen altında kalmalı.
7. Bekleyen kartta alternatif rozeti ve seçilen tarif adı görünmeli.
8. Kartı çevirip `Tarifi Gör` ile tarif detayına git.
9. Tarif detayında Dolabım karşılama yüzdesi ve zorunlu/opsiyonel/lezzetlendirici ayrımı görünmeli.
10. Alışveriş Listesi ekranında `Bugünün planından üret` çalıştır.
11. Seçilen alternatif tarif baz alınmalı; dolapta olan malzemeler sepete eklenmemeli.
12. Tarif kartını aç; eksikler ve `Dolabında var diye eklenmedi` bilgisi anlaşılır olmalı.
13. Dolabım ekranında ürün ekle/sil; liste sakin animasyonla güncellenmeli ve üst özet değişmeli.
14. Mutfak dışında telefonu salla; tarif arama tetiklenmemeli.
15. Mutfakta ürün seçip tarif bul; bu kez shake/alternatif akışları normal çalışmalı.
16. Rozetler ekranında sıradaki rozet ve ilerleme dili görünmeli.
17. Notlarım dışındayken yeni mesaj gelirse bottom bar bildirim işareti görünmeli; Notlarım açılınca sönmeli.

## Hızlı Regresyon Kontrolü

- Planım: `Yaptım` saat kuralı değişmemeli.
- Planım: Erken alternatif seçimi öğünü tamamlamamalı.
- Alışveriş: Aynı malzeme birden fazla öğünde geçerse tek satırda toplanmalı.
- Dolabım: Silme sonrası backend çağrısı sonsuz döngüye girmemeli.
- Bildirimler: Aynı başarı bildirimi kısa sürede spam üretmemeli.
- Türkçe: Kullanıcıya görünen yeni metinlerde bozuk karakter olmamalı.

## Otomatik Doğrulama

Çalıştırılan temel doğrulamalar:

```powershell
cd mobile-app
npx tsc --noEmit
```

```powershell
dotnet test tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj --no-build --no-restore -v minimal
dotnet test tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj --no-build --no-restore -v minimal
```
