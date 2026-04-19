# MyDietitian — Hoca Sunumu Soru & Cevap Rehberi

> Yarınki sunum için hazırlandı. Her başlık altında "hoca böyle sorabilir → böyle cevap ver" formatında.

---

## 1. Proje Nedir? (Açılış)

**Soru: "Projenizi kısaca tanıtır mısınız?"**

> Bu proje, diyetisyen ile danışan arasındaki süreci dijitalleştiren bir mobil + web platformudur. İki ayrı uygulama var:
> - **Mobil uygulama (React Native / Expo):** Danışanın günlük öğün takibi, su takibi, mutfak kullanımı ve kişisel gelişimini yönettiği uygulama.
> - **Web paneli (Next.js):** Diyetisyenin tüm danışanlarını yönettiği, plan oluşturduğu, mesajlaştığı ve aktivite akışını takip ettiği panel.
>
> İkisi de aynı backend API'yi paylaşıyor. Backend .NET 8 ile Clean Architecture pattern'inde yazıldı.

---

## 2. Teknoloji Seçimleri

### "Neden React Native ve Expo kullandınız, yerel (native) geliştirme neden değil?"

> React Native, tek bir kod tabanıyla hem Android hem iOS'a uygulama çıkarmanızı sağlar. Expo ise bunun üzerine oturan bir geliştirme çatısıdır — kamera, bildirimler, güvenli depolama gibi cihaz özelliklerine tek satır kod ile erişmenizi sağlar, her platform için ayrı ayrı native modül yazmak gerekmez. Bu projede örneğin:
> - `expo-camera` → fotoğraf çekme (malzeme tarama ekranı)
> - `expo-secure-store` → JWT token'ını şifrelenmiş şekilde saklamak
> - `expo-notifications` → öğün ve su hatırlatıcıları
> - `expo-image-picker` → profil fotoğrafı seçme
>
> Expo olmadan bunların her biri için platform bazlı native kod yazılması gerekirdi. Geliştirme süresini ciddi ölçüde kısaltır.

---

### "Next.js'i neden seçtiniz web paneli için?"

> Next.js, React tabanlı bir fullstack framework'tür. Server-Side Rendering (SSR) ve App Router mimarisi sayesinde sayfalar sunucu tarafında render edilerek SEO dostu ve hızlı yüklenen bir panel elde ettik. Ayrıca API route'ları ile bazı proxy işlemleri doğrudan Next.js içinde yazılabildi.

---

### "Backend mimarisi nasıl?"

> .NET 8 ile **Clean Architecture** uygulandı. Katmanlar:
> - **Domain:** Entity'ler, iş kuralları, repository arayüzleri
> - **Application:** CQRS pattern (MediatR ile) — her işlem bir Command veya Query
> - **Infrastructure:** Veritabanı (Entity Framework + PostgreSQL), OpenAI, bildirim servisleri
> - **API:** Controller'lar sadece HTTP katmanı — iş mantığı içermez
>
> Bu mimari sayesinde her bileşen bağımsız test edilebilir ve değiştirilebilir.

---

### "Veritabanı olarak ne kullandınız?"

> PostgreSQL. Entity Framework Core ORM ile yönetildi. İki ayrı DbContext var:
> - `AppDbContext` → uygulama verileri (tarifler, planlar, danışanlar)
> - `AuthDbContext` → kimlik doğrulama verileri (kullanıcı hesapları, JWT)

---

## 3. Animasyonlar

### "Mobil uygulamadaki animasyonlar nasıl yapıldı?"

> İki farklı kütüphane birlikte kullanıldı:
>
> **1. React Native Reanimated** — GPU'da çalışan, JavaScript thread'ini bloklamayan animasyonlar için. Örneğin kartların basınca hafifçe küçülmesi, ekrana giriş animasyonları (fade + yukarı kayma), streak sayacının çarpma animasyonu bunlarla yapıldı. `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming` API'leri kullanıldı.
>
> **2. React Native (standart) Animated** — Flip (kart çevirme) animasyonu için. Kartın `scaleX` değeri 1→0→1 olarak animasyonlanıyor: önce kart yatay olarak sıkıştırılıyor, tam sıkıştığı anda içerik değiştiriliyor, sonra tekrar açılıyor. Bu "kart döndü" hissini veriyor ama 3D backface karmaşıklığı olmadan.
>
> **Stagger animasyonu** — Liste elemanları ekrana sırayla geliyor (ilk kart, 50ms sonra ikinci, 50ms sonra üçüncü gibi). Bu `useStaggerItem` adında özel bir hook ile yapıldı.

---

### "Neden iki farklı animasyon kütüphanesi?"

> Reanimated ve standart RN Animated farklı senaryolara uygun. Reanimated, UI thread'inde çalıştığı için daha akıcı ve performanslı — özellikle scroll ve gesture bazlı animasyonlarda. Standart Animated ise daha basit ve kararlı, flip gibi tek seferlik transform animasyonları için yeterli. İkisini iç içe nested view olarak kullanmak güvenli — dış view Reanimated (press feedback), iç view standart Animated (flip).

---

## 4. OpenAI Entegrasyonu — Görsel Malzeme Tanıma

### "OpenAI'ı projenizde nasıl kullandınız?"

> İki ayrı yerde OpenAI entegrasyonu var:

**A) Görsel malzeme tanıma (Vision — GPT-4o):**
> Kullanıcı mutfağındaki malzemelerin fotoğrafını çekiyor. Bu görüntü base64 formatına dönüştürülüp backend API'ye gönderiliyor. Backend GPT-4o'nun vision özelliğini kullanarak görüntüdeki yiyeceklerin isimlerini metin listesi olarak döndürüyor ("domates", "tavuk", "zeytinyağı" gibi).

**B) Malzeme ismi → veritabanı eşleştirme (GPT-4o metin):**
> GPT'nin döndürdüğü ham isimler doğrudan veritabanımızdaki `Ingredients` tablosuyla eşleşmeyebilir. Örneğin GPT "cherry tomato" diyebilir ama veritabanında "kiraz domates" yazıyor. Bu eşleştirme için 4 kademeli bir resolver pipeline var.

---

### "Görsel'den malzeme tablosuna eşleştirme tam olarak nasıl çalışıyor?" *(Detaylı soru)*

> 4 katmanlı bir çözümleme pipeline'ı (resolver) var:
>
> **1. Mapping Table (VisionLabelMappings):** Daha önce onaylanmış eşleştirmeler veritabanında önbellek olarak tutuluyor. GPT "cherry tomato" dediyse ve daha önce bunu "kiraz domates" olarak eşleştirdiysek, direkt bu tablodan döner — OpenAI'a gitmez. Hem hızlı hem ucuz.
>
> **2. Canonical / Exact Alias eşleştirme:** Malzemenin canonical adı veya kayıtlı alias'larıyla tam eşleşme aranır. Örneğin "yoğurt" → `Yoğurt` direkt bulunur.
>
> **3. Fuzzy matching:** Yazım hatalarını veya yakın isimleri tolere eder. "Tavuk göğsü" → "Tavuk Göğsü" veya "Piliç Göğsü" gibi.
>
> **4. LLM fallback (OpenAI):** Yukarıdakilerin hiçbiri uymadıysa, GPT'ye "bu isim şu adaylardan hangisiyle eşleşir?" diye sorulur. Aday listesi kısaltılmış (shortlist) olarak gönderilir. GPT sadece bu listeden seçebilir — bu sayede "hallüsinasyon koruması" sağlanmış olur: GPT listede olmayan bir ID döndürürse sonuç reddedilir.
>
> Her eşleştirme güven skoru (confidence) ile gelir. Yüksek güven → otomatik kabul. Düşük güven → kullanıcıya onay ekranı çıkar.

---

### "Hallüsinasyon koruması nedir?"

> LLM'ler bazen veritabanında olmayan şeyler "uydurabilir". Bunu önlemek için GPT'ye sadece gerçek malzeme ID'lerinden oluşan bir aday listesi gönderiliyor ve yanıt olarak sadece bu listedeki bir ID kabul ediliyor. GPT listede olmayan bir GUID döndürürse sistem otomatik olarak "None" döner ve bu sonuç reddedilir.

---

## 5. Alternatif Tarif Sistemi

### "Alternatif tarif sistemi nasıl çalışıyor?"

> Kısaca: elindeki malzemelere göre "orijinal tarifi pişirebilir misin?" sorusunu yanıtlıyor, yanıt olumsuzsa en uygun alternatifleri sıralıyor.
>
> **Karar akışı:**
> 1. Kullanıcının elindeki malzemeler orijinal tarife karşı değerlendiriliyor.
> 2. Zorunlu malzeme eksikse veya eşleşme %80'in altındaysa alternatif aranıyor.
> 3. Alternatifler şu formülle sıralanıyor:
>
> ```
> CombinedScore = %40 Malzeme Uyumu + %60 Besin Değeri Yakınlığı
> ```
>
> Besin değeri yakınlığı kendi içinde ağırlıklı: protein %40, kalori %25, yağ %25, karbonhidrat %10. Yani protein içeriği en kritik eşleştirme kriteridir.
>
> **Önemli:** Sadece danışanın bağlı olduğu diyetisyenin tarifleri arasında arama yapılır — başka diyetisyenlerin tarifleri asla önerilmez.

---

### "İkame malzeme (substitute) desteği var mı?"

> Evet. `IngredientTaxonomyService` malzemeler arasındaki uyumluluğu bir taksonomi ağacı üzerinden çözüyor. Tarif tereyağı istiyorsa ama kullanıcının elinde margarin varsa, sistem bunu geçerli bir ikame olarak kabul ediyor ve eşleşme yüzdesini buna göre hesaplıyor.

---

## 6. Tunnel Mantığı

### "Geliştirme ortamında mobil uygulama backend'e nasıl bağlanıyor?"

> Bu aslında ciddi bir geliştirme mühendisliği sorunudur. Fiziksel bir telefon, `localhost:5000`'e erişemez çünkü "localhost" telefonun kendi makinesidir, geliştirici bilgisayarı değil. Üç çözümümüz var:
>
> **1. Android emülatörde:** Android emülatörü `10.0.2.2` adresini host makinenin loopback'ine yönlendirir. Bu özel bir Android emülatör özelliği. Uygulama otomatik olarak bunu tespit eder.
>
> **2. Aynı Wi-Fi ağında (LAN):** `192.168.x.x:5000` gibi bilgisayarın yerel IP adresi kullanılır. Aynı ağdaki tüm cihazlar erişebilir.
>
> **3. Cloudflare Tunnel (fiziksel cihaz / farklı ağ):**
> ```
> cloudflared tunnel --url http://localhost:5000
> ```
> Bu komut `xxx.trycloudflare.com` gibi geçici bir HTTPS URL'i oluşturur. Bu URL internetten erişilebilir olduğu için fiziksel telefon da, farklı ağdaki cihaz da bağlanabilir. URL `.env` dosyasına yazılır:
> ```
> EXPO_PUBLIC_API_BASE_URL=https://xxx.trycloudflare.com
> ```
> Uygulama hangi moda bakacağını şu öncelik sırasıyla belirliyor: önce force mode env var, sonra env var, sonra platform bazlı otomatik algılama.

---

## 7. Gamification Sistemi

### "Oyunlaştırma nasıl çalışıyor?"

> Kullanıcı her anlamlı eylemde puan/rozet kazanıyor. Sistem şunları takip ediyor:
> - Öğün tamamlama / alternatif seçme
> - Su hedefine ulaşma
> - Mutfak kullanımı (tarif oluşturma)
> - Ölçüm kaydetme
> - Uygulama açma
>
> **Seri (streak) sistemi:** Her gün için bir "nitelikli gün" skoru hesaplanıyor. Öğün uyumu, su, egzersiz gibi faktörler bir araya gelince o gün seriye sayılıyor. Seri kırılma riski varsa bildirim gönderiliyor.
>
> **Rozetler:** 10 farklı rozet var. Örneğin 7 günlük seri → "Haftalık Seri" rozeti, 3 ardışık gün su hedefi → "Su Koruyucusu" rozeti. Rozetler `ClientGamificationService` tarafından hesaplanıyor ve web panelde diyetisyen tarafından görülebiliyor.

---

## 8. Plan ve Öğün Takip Sistemi

### "Günlük plan takibi nasıl çalışıyor?"

> Diyetisyen web panelinden danışana günlük öğün planları oluşturuyor. Her öğün için tarih, saat, öğün tipi (kahvaltı, öğle, akşam vb.) ve tarif atanıyor.
>
> Danışan mobil uygulamada "Planım" sekmesinde bu öğünleri görüyor. Her öğün için 3 aksiyon var:
> - **Tamamla** → `POST /api/client/meals/{id}/complete`
> - **Atla** → `POST /api/client/meals/{id}/skip`
> - **Alternatif** → elindeki malzemeleri seçip alternatif tarif bulma akışını başlatıyor
>
> Tamamlanmış öğünler "TAMAMLANANLAR" bölümüne geçiyor. Alternatif seçildiyse bu kart çevrilebilir (flip animasyonu): ön yüz orijinal plan, arka yüz seçilen alternatifin besin değerleri.

---

## 9. Güvenlik

### "Kimlik doğrulama nasıl yapılıyor?"

> JWT (JSON Web Token) tabanlı kimlik doğrulama. Kullanıcı giriş yaptığında backend imzalı bir JWT token döndürüyor. Bu token mobil uygulamada `expo-secure-store`'a şifrelenmiş olarak kaydediliyor (telefon keychain'i kullanıyor). Her API isteğinde `Authorization: Bearer <token>` header'ı gönderiliyor.
>
> Şifre değiştirildiğinde backend yeni bir token döndürüyor, eski token geçersiz hale getirilebiliyor (`SignOutOtherSessions` parametresiyle).

### "Rate limiting var mı?"

> Evet. Özellikle hassas endpoint'lere (login, şifre değiştirme, vision analizi) `auth-strict` ve `kitchen-vision` gibi rate limit politikaları uygulandı. Bu brute-force saldırılarını ve API kötüye kullanımını engelliyor.

---

## 10. Premium Sistem

### "Ücretsiz ve premium kullanıcı farkı nedir?"

> Uygulama iki katmanlı çalışıyor:
> - **Ücretsiz kullanıcı:** Sadece temel ekranları görüyor (FreeHomeScreen). Planlara, mutfağa, detaylı takibe erişemiyor.
> - **Premium kullanıcı:** Tüm özellikler açık. Diyetisyen tarafından oluşturulan `access key` ile aktivasyon yapılıyor.
>
> Bu katmanlı yapı backend'de policy bazlı (`[Authorize(Policy = "Client")]`) ve frontend'de route seviyesinde (`isPremium` check) kontrol ediliyor.

---

## 11. Multi-Tenant Yapı

### "Bir diyetisyenin danışanı başka diyetisyenin tariflerini görebilir mi?"

> Hayır. Sistem multi-tenant (çok kiracılı) mimaride. Her diyetisyen kendi tarif havuzuna sahip. Danışana yalnızca bağlı olduğu diyetisyenin tarifleri gösteriliyor. Bunun yanında "global public" tarifler de var — diyetisyen tarafından herkese açık olarak işaretlenen tarifler yedek olarak kullanılabiliyor, ama öncelik her zaman kendi diyetisyenin özel tarifleri.

---

## 12. Web Panel

### "Web panelinde ne var?"

> Next.js ile yazılmış diyetisyen yönetim paneli:
> - **Dashboard:** Tüm danışanlara ait canlı aktivite akışı (30 saniyede bir yenileniyor), danışan sayısı, aktif planlar
> - **Danışan yönetimi:** Profil, ölçümler, aktivite geçmişi, haftalık uyum
> - **Plan oluşturma:** Takvim tabanlı günlük öğün planı oluşturma ve atama
> - **Mesajlaşma (Care Hub):** Danışanla mesajlaşma, diyetisyen notu ekleme
> - **Tarif yönetimi:** Tarif ekleme, malzeme eşleme, besin değeri girişi
> - **Gamification görünümü:** Danışanın seri durumu, rozetleri, aktivite detayları

---

## 13. Olası Zor Sorular

### "Projenizin en büyük teknik zorluğu neydi?"

> İki büyük zorluk vardı:
>
> 1. **Görsel malzeme eşleştirme pipeline'ı:** GPT'nin döndürdüğü serbest metin isimlerini veritabanındaki canonik malzeme kayıtlarıyla güvenilir şekilde eşleştirmek. Hallüsinasyon koruması, confidence eşikleri ve 4 katmanlı resolver bunu çözdü.
>
> 2. **Gerçek zamanlı gesture ve animasyon uyumu:** PanResponder (kaydırma hareketi) ve Pressable (uzun basma) aynı kart üzerinde çakışıyordu. PanResponder dokunuşu yakalayıp Pressable'ın olayı almasını engelliyordu. Çözüm: gizli Pressable yerine açıkça görünen TouchableOpacity butonu kullanmak.

---

### "Ölçeklenebilirlik düşünüldü mü?"

> Evet. Clean Architecture sayesinde her katman bağımsız. Veritabanı sorguları AsNoTracking ile optimize edildi. Rate limiting API'yi koruma altına alıyor. Gelecekte microservice'lere bölünmesi mümkün çünkü her domain (auth, recipe, plan, gamification) zaten ayrı controller ve handler'lara sahip.

---

### "Test yapıldı mı?"

> Backend servisleri için unit test altyapısı kuruldu. Frontend tarafında manuel test + TypeScript'in tip güvenliği kullanıldı. `npx tsc --noEmit` ile her geliştirme sonrası tip hatası kontrolü yapıldı.

---

### "Kullanıcı verisi güvenliği nasıl sağlandı?"

> - JWT token'ları cihazda şifrelenmiş `SecureStore`'da tutuluyor (platform keychain)
> - Şifreler backend'de hash'lenerek saklanıyor (identity framework)
> - HTTPS zorunlu (development'ta Cloudflare tunnel HTTPS, produksiyonda TLS)
> - Her endpoint `[Authorize]` attribute'u ile korunuyor
> - Multi-tenant izolasyon: bir diyetisyen başkasının danışanına erişemiyor

---

*Hazırlayan: Proje dokümantasyonu — Sunum tarihi: 2026-04-21*
