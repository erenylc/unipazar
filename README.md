# Üni Satış

Üniversite öğrencileri için mobil öncelikli ikinci el pazar ve Dayanışma uygulamasının ilk çalışan sürümü.

## Üniversite e-postası

Üniversite e-postası `Hesabım` üzerinden ayrıca doğrulanabilir: `.edu.tr` posta kutusuna tek kullanımlık kod gönderilir. Bu rozet yalnızca bu posta kutusuna erişimi kanıtlar; seçilen üniversiteye veya öğrenciliğe ilişkin belge onayı değildir.

## Güvenlik, aramalar, değerlendirme ve operasyon

- `Yönetim` ekranında seri ilan, aynı fotoğraf, tekrarlanan şikâyet ve ilan açıklamasındaki kapora ifadesi için gerekçeli risk kuyruğu vardır. İşaretler otomatik suçlama/hesap kapatma değildir; yönetici inceleme sonucu kaydeder.
- `Şikâyetlerim` ekranı kullanıcıya sadece kendi kayıtlarını, alındı/inceleniyor/sonuçlandı durumunu ve yönetici açıklamasını gösterir. Sonuca bir kez gerekçeli itiraz gönderilebilir.
- İki taraf sohbetten teslimatı ayrı ayrı onayladığında satış tamamlanır. Telefon/e-postası doğrulanmış alıcı bu işlem için bir değerlendirme yapabilir. Profilde hesap tarihi, iki tarafça onaylanan satış sayısı ve gerçek işlem bağlantılı yorumlar gösterilir. Bu karşılıklı onay fiziksel teslimatı bağımsız biçimde kanıtlamaz.
- Fiyat aralığı, ürün durumu, sıralama ve kaydedilen aramalar vardır. Yeni ilan bildirimleri kullanıcının seçimiyle uygulama içinde gösterilir; arka planda push/e-posta bildirimi değildir.
- Hız ölçümleri sayfa yükleme, fotoğraf ve API sürelerini mobil/masaüstü sınıfıyla kaydeder; soru, mesaj, e-posta, telefon veya kullanıcı kimliği ölçümlere yazılmaz. Yönetici ekranında hata ve süre özetleri görünür. Ölçümler 14 gün ve 10.000 kayıtla sınırlıdır.
- Üretimde 6 saatte bir SQLite ve ilgili ilan/profil/mesaj/ses dosyalarının yedeği alınır; son 7 tamamlanmış yedek tutulur. `BACKUP_ENABLED=0` kapatır. Varsayılan `DATA_DIR/backups` aynı disktedir; tüm disk kaybına karşı ayrı depolamaya kopyalama gerekir. Yedekler web üzerinden sunulmaz.
- Yedeği kontrol et: `node scripts/restore-backup.mjs YEDEK_DIZINI`. Yeni bir dizine geri yükle: `node scripts/restore-backup.mjs YEDEK_DIZINI YENI_HEDEF_DIZINI`. Mevcut dizinlerin üzerine yazılmaz. Başlamadan önce uygulamayı durdur; ardından dönen `dataDir` ve `uploadDir` yollarını sunucuya ayarla. SHA-256 ve SQLite bütünlük kontrolleri geçmeden geri yükleme başlamaz.

## Telefon ve e-posta doğrulaması

Netgsm hesabında OTP SMS paketi, onaylı gönderici başlığı ve API erişimi açıldıktan sonra Railway'in gizli ortam değişkenlerine `NETGSM_USERCODE`, `NETGSM_PASSWORD` ve `NETGSM_HEADER` eklenir. Anahtarları Git'e veya sohbete yazma. Bu üç ayar mevcut olduğunda telefon doğrulaması ilan verme, sohbet başlatma, mesaj gönderme, teklif ve ürün talebi için zorunlu olur. `REQUIRE_CONTACT_VERIFICATION=1` aynı kontrolü hizmet etkin olmasa da zorunlu yapar; servis hazırlanmadan açılırsa kullanıcılar işlem yapamaz. Üretimde bu işlemler için e-posta doğrulaması da zorunludur.

Telefon kodları 3 dakika geçerli, tek kullanımlık ve 5 yanlış denemeden sonra kilitlidir. Tekrar gönderimde 60 saniye beklenir; kullanıcı veya numara başına saatte 3, 24 saatte 6 istek ve varsayılan uygulama toplamı 100/24 saat sınırı bulunur (`SMS_DAILY_LIMIT`). Kodlar veritabanına özet olarak yazılır; sağlayıcı şifresi tarayıcıya veya loglara yazılmaz. SMS başarısızsa doğrulama verilmez. Aynı doğrulanmış numara iki hesaba bağlanamaz; numara değişince doğrulama sıfırlanır. Gerçek SMS olmadan test kodu yalnızca `NODE_ENV=test` ve `TEST_PHONE_CODES=1` birlikteyken kullanılabilir. E-posta kodunda da 5 yanlış deneme sınırı vardır.

Doğrulama, numara/e-posta erişimini kanıtlar; kimlik veya öğrencilik garantisi değildir. Kamuya açık satıcı ekranında sadece doğrulama durumları gösterilir; numara ve adres paylaşılmaz. Hizmet açılmadan gerçek SMS teslimatı tamamlanmış sayılmaz.

## Android / Google Play hazırlığı

`android/` klasörü, canlı PWA manifestinden üretilmiş Trusted Web Activity projesidir. Paket kimliği şimdilik `com.unisatis.app`, açılış adresi `https://unipazar-production.up.railway.app/#/` ve hedef Android API 36'dır. İlk Play yayını öncesinde paket kimliğini ve kalıcı alan adını kesinleştir; yayınlandıktan sonra paket kimliği değiştirilemez. Bu Android kabuğu canlı siteye ihtiyaç duyar. Uygulamanın mevcut çevrimdışı sayfası dışındaki içerik ve oturumlar sunucudan gelir.

1. Android SDK (API 36, Build-Tools 36.0.0) ve JDK 17 kur. Windows PowerShell'de `JAVA_HOME` ile `ANDROID_HOME` ortam değişkenlerini bu kurulumlara ayarlayıp `./scripts/build-android.ps1` çalıştır. Betik imzalı test APK'sı `android/app-release-signed.apk` ve Play'e yüklenecek imzalı `android/app-release-bundle.aab` üretir. `android/twa-manifest.json` içindeki `signingKey.path` değeri `android.keystore` dosyasını gösterir. Bu projede yerel upload key `android/android.keystore` konumunda oluşturuldu; parolası `android/signing-password.txt` dosyasındadır. Her iki dosyanın güvenli yedeğini al; Git'e ekleme ve kimseyle paylaşma. Genel sertifika parmak izi `android/upload-certificate-sha256.txt` dosyasındadır. Anahtar kaybolursa güncellemelerin imzalanması için Play Console'da upload key sıfırlama süreci gerekir. Her güncellemede `appVersionCode` artırılmalıdır.
2. Sunucu, bu projede imzalanan APK'nın SHA-256 parmak izini `/.well-known/assetlinks.json` içinde yayımlar. Play Console'da uygulamayı oluşturduktan sonra Play App Signing sertifikasının SHA-256 parmak izini al ve barındırma ortamına `PLAY_APP_SIGNING_SHA256` olarak, iki haneli büyük harfli onaltılık gruplar ve `:` ayraçlarıyla ekle. Gerekirse başka bir upload key için `ANDROID_UPLOAD_SHA256` da eklenebilir. Bu adresin canlı sitede 200 yanıtı verdiğini ve paket kimliğini doğrula; aksi hâlde uygulama tam ekran yerine Custom Tab olarak açılır.
3. APK'yı gerçek Android telefonda sınayıp giriş/kayıt, Google ile giriş, ilan fotoğrafı, sohbet kamerası, mikrofon, çerezli oturum ve çevrimdışı ekranı kontrol et. Ardından AAB'yi önce Play Console iç test kanalına yükle.

Uygulama içindeki **Hesabımı sil** işlemi aktif veritabanındaki hesabı, ilanları, mesajları ve ilgili dosyaları siler. Herkese açık `/delete-account.html` yolu bu işlemi nasıl başlatacağını açıklar; girişe erişemeyen kullanıcılar `unisatis06@gmail.com` adresinden talep gönderebilir. Bire bir sohbette kullanıcı engelleme ve ilan/mesaj şikâyeti vardır. Yönetici tarafından yapılan **hesap kapatma** ayrı bir işlemdir ve verileri silmez. Play yayınına geçmeden önce işletmeci kimliği, son hukuki metinler, yedek/veri saklama politikası, Veri güvenliği formu, mağaza görselleri ve içerik derecelendirmesi tamamlanmalıdır. İlgili Play kuralları: [hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111), [kullanıcı içeriği](https://support.google.com/googleplay/android-developer/answer/9876937).

## iPhone / App Store hazırlığı

`ios/` klasöründe iPhone için XcodeGen proje tanımı ve Swift kaynakları bulunur. Kurulum ve sınama adımları [iOS README](ios/README.md) içindedir. Bu Windows ortamında Xcode bulunmadığı için iOS uygulaması henüz derlenip gerçek iPhone'da doğrulanamadı. Apple'ın [minimum işlevsellik kuralı](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality) nedeniyle App Store kabulü de ayrıca incelemeye bağlıdır.

## Yerelde çalıştırma

Node.js 24 veya üzeri gerekir.

```powershell
cd unipazar
npm ci
Copy-Item .env.example .env
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini aç. Yerel geliştirme ortamında ad ve soyad, listedeki üniversite, geçerli biçimli e-posta adresi ve en az 10 karakterlik şifreyle hesap hemen açılır; aynı bilgilerle tekrar giriş yapılabilir. E-posta sahipliği, gönderim hizmeti olmadan doğrulanamaz. İlan vermek için yönetici onayı gerekmez. Kişisel e-posta adresleri kullanılabilir. Örnek ilan oluşturulmaz; ürün başlığı, fiyatı ve 1–6 fotoğrafı öğrenci ekler. Üniversite seçimi, [e-Devlet üniversite hizmet listesinden](https://www.turkiye.gov.tr/universite-hizmet-listesi) alınan `universities.json` verisini kullanır.

Ana sayfa kayıtlı üniversiteyi ilk seçim olarak gösterir; kullanıcı başka üniversitelerin ikinci el satış ilanlarına da bakabilir ve satıcıya özel mesaj gönderebilir. Arama Türkçe karakter farklarını eşit kabul eder; uzunluğa göre bir veya iki harflik yazım hatasını da eşleştirir ve doğrudan eşleşmeleri önce gösterir. Ücretsiz Dayanışma ilanları yalnızca hesabın kayıtlı olduğu üniversitedeki destek isteyen öğrencilere ve ilan sahibine açıktır. Öğrenci profili yalnızca yayındaki ikinci el satış ilanlarını gösterir. Özel mesajlar, fotoğraflar ve ses kayıtları konuşmanın iki katılımcısına açıktır; yönetici şikâyet incelemesinde gerekçe kaydı oluşturarak bunları salt okunur biçimde görüntüleyebilir. İncelemeler `admin_message_reviews` tablosunda kayıt altına alınır. Açık oturumlarda yeni mesajlar ve okunmamış sayısı sayfa yenilenmeden görünür. Mesajdaki fotoğraf düğmesinden canlı kamera veya galeri seçilir; ses düğmesinden en fazla 60 saniyelik kayıt gönderilir. Kamera ve mikrofon izni yalnızca kullanıcı ilgili düğmeye bastığında istenir.

Hesabım sayfasında ad, e-posta ve üniversite güncellenebilir. E-posta değişikliği mevcut şifreyi ister. SMTP yapılandırılmışsa yeni adrese doğrulama kodu gönderilir; yerel SMTP olmayan ortamda adres değişir ancak e-posta sahipliği doğrulanmış sayılmaz. Üniversite değişikliği yeni ilanları ve varsayılan keşif filtresini etkiler; daha önce yayımlanan ilanların üniversitesi korunur.

## Yönetici hesabı

Önce uygulamada kendi hesabını oluştur. Uygulamanın çalıştığı bilgisayarda şu komutla mevcut hesabına yönetici yetkisi ver:

```powershell
npm run admin:grant -- kullanici@ornek.com
```

E-posta adresini kendi hesabının adresiyle değiştir; sayfayı yenile. Üst menüde **Yönetim** açılır. Veritabanı en fazla bir yönetici hesabına izin verir; kayıt formu veya web API'si ikinci bir yönetici atayamaz.

Yönetim ekranında yalnızca destek formunu gönderenlerin başvuruları görünür. Ad, e-posta, telefon, üniversite, aylık aile geliri, başvuru gerekçesi ve kimlik numarasının saklanan son 4 hanesi incelenebilir. Tam kimlik numarası alınmaz. Yönetici başvuruyu kabul veya reddeder; kabul edilen öğrenci kendi üniversitesindeki ücretsiz Dayanışma ilanlarına erişir. Şikâyetler ve bütün hesapların temel bilgileri de bu ekrandadır. Hesap kapatılınca mevcut oturumları geçersiz olur ve yayındaki ilanları kaldırılır; yönetici hesabı kapatılamaz. Kapatılan hesap yeniden açılabilir, ancak kaldırılan ilanları kendiliğinden yayına dönmez. Normal ikinci el ilanı vermek yönetici onayına bağlı değildir.

## Canlı ortam için gerekli yapılandırma

Bu repository kaynak kodu ve boş `.env.example` şablonunu içerir. Hesaplar, oturumlar, mesajlar, ses kayıtları, yüklenen fotoğraflar ve gerçek `.env` dosyaları Git'e dahil edilmez. Yeni bir kurulum boş veritabanıyla başlar; mevcut veriler gerektiğinde ayrı ve güvenli bir yedekten taşınmalıdır.

Deploy hazırlığı: Node.js 24 kullan, kurulum komutunu `npm ci`, başlatma komutunu `npm start` olarak ayarla. Uygulama sağlayıcının `PORT` ortam değişkenini kullanır. `NODE_ENV=production`, bir e-posta gönderim yöntemi ve HTTPS canlı ortamda gereklidir. `DATA_DIR` ve `UPLOAD_DIR` kalıcı diskte olmalıdır; geçici dosya sisteminde hesaplar ve fotoğraflar yeniden başlatma veya deploy sırasında kaybolabilir. Ayarları hosting sağlayıcısının gizli ortam değişkenleri üzerinden ver; `.env` dosyasını repository'ye yükleme. Yönetici hesabı, o sunucuda kayıt yapıldıktan sonra `npm run admin:grant -- kendi-epostan` komutuyla atanır.

Railway Free/Trial planında SMTP çıkışı kapalıdır. Bu planlarda Brevo'nun HTTPS API'sini kullanmak için Brevo'da doğrulanmış bir gönderici oluştur, API anahtarı al ve Railway hizmet değişkenlerine `BREVO_API_KEY` ile `BREVO_FROM` (doğrulanmış gönderici adresi) ekle. Gizli API anahtarını `.env` veya GitHub'a koyma. Kod değişikliği gerekmeksizin yeniden dağıtım sonrası `/api/me` yanıtında `emailVerificationAvailable: true` görünmelidir. Gerçek bir alıcıyla kayıt ve gelen doğrulama kodunu test et; API'nin e-postayı kabul etmesi gelen kutusuna teslim edildiğini tek başına kanıtlamaz.

Canlı ortamda `NODE_ENV=production`, HTTPS ve Brevo HTTPS API veya SMTP destekleyen bir barındırıcı gerekir. Gönderim yapılandırması olmadan canlı kayıt kapalıdır. Doğrulama kodu kullanıcının girdiği adrese gönderilir. Kodu API yanıtında gösteren mod yalnızca ayrı test sürecinde `NODE_ENV=test` ve `TEST_EMAIL_CODES=1` ile kullanılabilir. İlan fotoğrafları `uploads/`, özel mesaj fotoğrafları `data/message-photos/`, SQLite veritabanı `data/` klasöründe saklanır; bu klasörler yedeklenmelidir. `DATA_DIR` ve `UPLOAD_DIR` ile konumları değiştirilebilir.

Bu sürüm üniversite bazlı pilot içindir. “Beni hatırla” seçiliyse oturum çerezi 30 gün, seçili değilse tarayıcı oturumu boyunca saklanır. Çıkış yapma sunucudaki oturumu da geçersiz kılar. Destek başvurusu kayıt sonrasında ayrı sayfada gerekçe, aylık aile geliri ve TC kimlik numarasının yalnızca son 4 hanesiyle yapılır. Başvuru yönetici incelemesinden sonra kabul edilirse ücretsiz ilanlara erişim açılır. Girilen bilgiler bağımsız kimlik veya gelir doğrulaması sayılmaz. Ücretsiz ilanlar yalnızca kabul edilen destek hesabına ve ilan sahibine gösterilir. Yayındaki veya ayrılmış ilanlar oluşturulmalarından 180 gün sonra otomatik olarak süresi dolmuş duruma geçer; sahibi bunları yönetim ekranında görebilir. Satılmış ilanlar bu kurala girmez. Kullanıcı aynı anda en çok 3 açık ücretsiz ürün talebi oluşturabilir. Mesaj fotoğrafları `data/message-photos/`, ses kayıtları `data/message-voice/` içinde saklanır. Ödeme/kargo, belgeye dayalı ihtiyaç incelemesi, mobil arka plan bildirimleri ve daha büyük ölçekli depolama henüz eklenmedi.

## Kontrol

### Uygulama asistanı ve fotoğraf denetimi

Web ve Android TWA aynı sağ alt asistanı kullanır. Yardım bilgileri `public/help-topics.js` içindedir. Anahtar olmadan konu eşleştirmesiyle uygulama yardımı verir. OpenAI bağlanınca Responses API bu bilgilerden doğal cevaplar üretir; son 10 sohbet mesajı takip sorularını anlaması için gönderilir, `store:false` kullanılır. Hesap kayıtları, özel mesajlar ve başvurular servise verilmez. Tarayıcı destekliyorsa mikrofonla soru yazdırılır ve öğrenci gönder düğmesiyle metni gönderir; desteklenmeyen tarayıcıda telefon klavyesinin mikrofonu kullanılabilir. Soru başına 600 karakter, IP başına dakikada 12 istek, en fazla 4 eşzamanlı yanıt ve varsayılan günde 200 AI isteği sınırı vardır; günlük sınır sonrası yerel yardım devam eder. Günlük sayaç tek sunucu süreci içindir ve yeniden başlatılınca sıfırlanır.

1. `OPENAI_API_KEY` değerini yerel `.env` dosyasına veya Railway'nin gizli ortam değişkenlerine ekle. Anahtarı kaynak koda, tarayıcıya, APK'ya veya Git'e koyma.
2. `APP_ASSISTANT_MODEL=gpt-4.1-mini` ve isteğe bağlı `APP_ASSISTANT_DAILY_LIMIT=200` ayarla. Soru yanıtları için API kullanım ücreti oluşabilir.
3. Fotoğraf denetimini etkinleştirmek için `PHOTO_MODERATION_ENABLED=1` ayarla ve sunucuyu yeniden başlat. Varsayılan `0`: **otomatik içerik denetimi kapalıdır**. Anahtar eksikken denetim yapılmış gibi gösterilmez.
4. Etkinleştirince fotoğraf seçiminde kontrol başlar; ilan oluşturma/düzenleme ve profil kaydetmede sunucu kontrolü tekrar uygular. İstemci kontrolünü atlamak korumayı atlamaz. Reddedilen görsel diske veya veritabanına kaydedilmez. Servis kesintisi, eksik anahtar, belirsiz yanıt ve zaman aşımı yüklemeyi engeller. Yeni bir grupta tek fotoğraf reddedilirse o grubun tamamı eklenmez; başka görseller seçilebilir.

Kontrol OpenAI `omni-moderation-latest` ile optimize edilmiş, üst verileri temizlenmiş görsellere uygulanır. Cinsel içerik, şiddet, grafik şiddet ve kendine zarar verme işaretleri reddedilir. Sonuçlar yalnızca görsel özetiyle sunucu belleğinde 5 dakika tutulur (en fazla 256 kayıt); görsel veya sağlayıcı yanıtı loglanmaz. Bu özellik yeni yüklemeler içindir; eski görselleri geriye dönük taramaz. İnsan incelemesi ve şikâyet akışı korunur; otomatik tespit yüzde yüz doğruluk garantisi değildir ve özel çocuk güvenliği denetimi yerine geçmez. Mesaj fotoğrafları bu entegrasyona dahil değildir.

Etkinleştirmeden önce kullanıcı bilgilendirmesini ve OpenAI'ye aktarımın işletmeci gerekliliklerini tamamla. `legal-documents.js` sağlayıcı bildirimini içerir; mevcut taslak etkinleştirme akışı korunur. API anahtarı olmadan testler sahte servis yanıtları kullanır; gerçek sınıflandırma doğruluğu bu testlerden çıkarılamaz.

### Kayıt, KVKK ve Google ile giriş

Kayıt formunda “Beni hatırla” bulunmaz; yeni hesap oturum çereziyle açılır. Şifreli giriş formunda seçenek korunur. Tarayıcı otomatik doldurması için ad, e-posta, telefon ve yeni şifre alanlarında autocomplete tanımlıdır.

`legal-documents.js` ÜniSatış'ın gerçek özelliklerine göre hazırlanmış iki ayrı metin taslağı içerir: üyelik sözleşmesi ve KVKK aydınlatma metni. Metinler, işletmeci kimliğini ve başvuru e-postasını `LEGAL_CONTROLLER_NAME` ve `LEGAL_CONTACT_EMAIL` ile ayarlayıp `LEGAL_ENABLED=1` yapana kadar yayımlanmaz. İsteğe bağlı `LEGAL_CONTACT_ADDRESS` fiziksel başvuru adresidir. Metin ve gerçek uygulamalar; saklama/silme süreleri, destek başvuruları, yönetici incelemeleri ve Railway/Brevo/Google için yurt dışı aktarım mekanizması bakımından yayımlamadan önce değerlendirilmelidir. Metin veya checkbox eklemek tek başına KVKK uyumunu sağlamaz. Belgelerde esaslı değişiklik yapıldığında `LEGAL_VERSION` güncellenmelidir. Etkinleştirilince kayıt için iki ayrı, başlangıçta boş kutu gösterilir; sunucu aynı kontrolleri uygular ve kabul tarihiyle belgelerin tam sürümünü veritabanına kaydeder. Pazarlama veya genel açık rıza kutusu yoktur.

Google ile giriş için Google Cloud/Google Auth Platform'da bir **Web application** OAuth istemcisi oluştur. Authorized JavaScript origins alanına `https://unipazar-production.up.railway.app` ve yerel denemeler için `http://localhost:3000` ekle (hash veya yol ekleme). OAuth consent screen/branding ve test/yayın durumunu tamamla. Google'ın doğrulanmış domain şartları varsa Railway alt alan adıyla domain sahipliği doğrulanamayabilir; bu durumda sahip olduğun özel alan adı gerekir. Oluşan herkese açık client ID'yi Railway'de `GOOGLE_CLIENT_ID` olarak ayarla; bu akış client secret istemez.

Yapılandırılınca giriş ve kayıtta Google'ın resmi düğmesi görünür. ID token imzası, hedef client ID, süre ve tek kullanımlık nonce sunucuda doğrulanır. Google hesabı yeni ise ad/e-posta doldurulur; kullanıcı üniversite, telefon ve etkinleştirilmiş belgeleri tamamlar. Gmail veya doğrulanmış Workspace adresleri doğrulanmış kabul edilir; diğer Google e-postaları ayrıca uygulamanın e-posta koduyla doğrulanır. Var olan doğrulanmış hesap yalnızca Google'ın yetkili olduğu aynı e-posta ile eşleştirilir; aksi durumda şifreli giriş gerekir. Google yalnızca hesap sahipliğini doğrular, gerçek kişi kimliğini veya öğrenciliği doğrulamaz. Google'dan telefon, üniversite ve şifre alınmaz. Gerçek Google hesabıyla uçtan uca test için OAuth client ID gereklidir.

```powershell
npm run check
npm test
npm audit --audit-level=high
```
