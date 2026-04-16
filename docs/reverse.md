Projede iPhone gerçek cihaz testi için yaptığın local network/env değişikliklerini geri al.

Amaç:

* iPhone testine özel yapılan değişiklikler temizlensin
* proje eski geliştirme davranışına dönsün
* local IP `172.20.10.4` ve buna bağlı force/base url ayarları kaldırılsın
* Expo Go / physical device odaklı geçici ayarlar temizlensin
* production veya mevcut normal development akışı bozulmasın

Önce analiz et, sonra uygula.

Geri almak istediğim değişikliklerin kapsamı:

* `mobile-app/.env` içindeki iPhone LAN testi için eklenen ayarlar
* `mobile-app/.env.example` içine eklenen iPhone / physical device açıklamaları
* `EXPO_PUBLIC_API_BASE_URL=http://172.20.10.4:5000`
* `EXPO_PUBLIC_API_BASE_URL_FORCE=1`
* iPhone testi için eklenen özel timeout / force / manual LAN davranışları
* sırf iPhone gerçek cihaz testi için yapılmış geçici açıklamalar ve dokümantasyon notları

İzleyeceğin yol:

1. Önce hangi dosyalarda iPhone testi için değişiklik yapıldığını tespit et.
2. Bu değişiklikleri git diff mantığıyla ayır:

   * yalnızca iPhone testine özel olanları geri al
   * projede gerçekten gerekli, genel geliştirme davranışı olanları bırak
3. Şunları özellikle kontrol et:

   * `mobile-app/.env`
   * `mobile-app/.env.example`
   * `app.config.ts` / `app.config.js`
   * `api.ts`, `client.ts`, `routes.ts`, config helper dosyaları
   * `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_API_BASE_URL_FORCE`, `EXPO_PUBLIC_API_TIMEOUT_MS`
4. Eğer bir değer iPhone testi için hardcode edildiyse kaldır.
5. Eski davranışa dön:

   * auto-detect varsa tekrar aktif olsun
   * force edilen LAN IP davranışı kapansın
   * iPhone’a özel metinler ve comments temizlensin
6. Web paneli ve backend’i bozma.
7. Başka unrelated değişiklik yapma.
8. En sonda bana rapor ver:

   * değişen dosyalar
   * hangi satırlar geri alındı
   * yeni/son davranış ne oldu
   * projeyi artık normal şekilde nasıl çalıştıracağım

Çok önemli:

* tahmin etme, gerçekten değiştirdiğin yerleri bulup yalnız onları revert et
* tam dosyayı rastgele sıfırlama
* sadece iPhone testi için eklenen geçici ayarları kaldır
* eğer `.env.example` içindeki genel faydalı açıklamalar iPhone’a özel değilse koru, ama `172.20.10.4` ve physical-device özel yönlendirmeleri kaldır

Önce kısa analiz ver, sonra implement et.
