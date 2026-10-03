# Üni Satış

Üniversite öğrencileri için mobil öncelikli ikinci el pazar ve Dayanışma uygulamasının ilk çalışan sürümü.

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
