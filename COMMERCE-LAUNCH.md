# Üniversiteler arası alışveriş — hazırlık ve açılış

## Şu an çalışan bölüm

İlk sürüm öğrencilerin kendi ikinci el eşyaları içindir. İlandan teslimat tercihiyle sipariş taslağı kaydedilebilir; Hesabım ekranından incelenebilir ve silinebilir. Taslak ürünü ayırmaz, satıcıya sipariş göndermez, ödeme almaz. İlan fiyatı sunucudan okunur. Kargo/hizmet bedeli bilinmediğinde toplam ücret uydurulmaz. Aynı kullanıcı ve ilan için yeniden kaydetme mevcut taslağı günceller. Hesap veya ilan silindiğinde taslak silinir. En fazla 20 açık taslak tutulur.

`/api/commerce/drafts/:id/pay` her zaman ödeme hizmetinin kapalı olduğunu döndürür. Ortam değişkeniyle açılabilen sahte bir ödeme modu yoktur. Mevcut mesajlaşma ve elden alışveriş akışı devam eder. Bu hazırlık, gerçek bir sipariş veya para koruma sistemi değildir.

## Gerçek siparişin hedef akışı

1. Satıcı bireysel ödeme kuruluşu alt üyesi olarak kaydedilir; gerekli kimlik/IBAN bilgilerinin doğrulanması sağlayıcının gereksinimlerine göre yapılır.
2. Satıcı gönderime izin verir; ürün boyutu, kargo ücreti ve gönderim süresi belirlenir. Öğrencinin şehir dışı alım tercihi satıcının onayı değildir.
3. Ürün fiyatı, tüm kesintiler, kargo, toplam tutar, satıcıya aktarılacak tutar ve iade koşulları ödeme öncesi gösterilir; sözleşmenin kabul edilen sürümü kaydedilir.
4. Ödeme oturumu açılırken tek ürün atomik olarak kısa süreli ayrılır. Süre dolduğunda ödeme kuruluşuyla durum mutabakatı yapılmadan ayırma kaldırılmaz.
5. Tarayıcının başarı ekranına güvenilmez. İmzalı sağlayıcı bildirimi / sağlayıcı API sorgusu, tutar, para birimi, sipariş, işlem kimliği ve satıcı doğrulanır. Aynı bildirim tekrar geldiğinde yeniden işlem yapılmaz.
6. Fotoğraflar dahil ilan koşulları siparişin değişmez kaydı olur. Dosyalar sıradan ilan silme işleminden ayrı bir saklama politikasıyla korunur.
7. Gerçek kargo olayları izlenir. Kullanıcının takip numarası yazması teslimat kanıtı değildir. Teslim edildi bilgisi ürünün açıklamaya uygunluğunu kanıtlamaz.
8. Alıcı inceleme, iade veya itiraz başlatabilir. İtiraz varken satıcıya otomatik aktarım durdurulur. Satıcı da iade edilen ürün hakkında kanıt ve itiraz sunabilir. Otomatik fotoğraf denetimi alışveriş uyuşmazlığı hakkında tek başına karar vermez.
9. Sağlayıcı onayıyla aktarım veya geri ödeme yapılır. Başlatılan iade ile tamamlanan iade ayrı durumlardır; işlem hata ve tekrarlarında muhasebe kaydı çift oluşmaz. Harcama itirazları ayrıca izlenir.

Kampüste teslim için de ayrı bir doğrulama tasarlanmalıdır; alıcının kontrolü ve onayı olmadan satıcının tek tıklamasıyla ödeme bırakılmaz.

## Gerçek ödeme açılmadan gereken bilgiler

- İşletmecinin tam adı, işletme/vergi bilgileri, açık adresi ve iletişim bilgileri. Destek e-postası: unisatis06@gmail.com. Kullanıcının bu belgeleri sağlaması bekleniyor.
- Bireysel ikinci el satıcıları kabul eden ödeme kuruluşuyla onaylı pazaryeri sözleşmesi, test erişimi ve gerçek kullanım yetkisi. iyzico belgelerinde bireysel alt üyelik ve ödeme kırılımı desteği vardır; bizim başvurumuzun kabul edildiği veya özel bekletme koşullarının uygun olduğu anlamına gelmez.
- Kargo sözleşmesi, API erişimi, desi/ölçü sınırları, kayıp/hasar ve gidiş/iade ücretleri. Sınırsız ücretsiz kargo vaat edilmez.
- İşletmeci için vergi, ETBIS, satıcı/işlem bildirimleri ve yürürlükteki mevzuata göre kayıt yükümlülüklerinin mali müşavir tarafından değerlendirilmesi. Bireysel satıcının düzenli ticaret yapmaya başlaması için ayrıca süreç gerekir.
- Üyelik, ön bilgilendirme, ödeme hizmeti, iptal/iade, uyuşmazlık ve gizlilik metinlerinin gerçek hizmet koşullarıyla uyumlu hukuk incelemesi. Ticari satıcı açılmadan ayrı kurallar gerekir. Sahibinden'in bireysel 2 günlük platform kuralı tüm kanuni hakların süresi gibi kullanılmaz.
- Veri minimizasyonu, erişim yetkileri, saklama ve silme süreleri; Railway/Brevo/OpenAI ve ödeme/kargo sağlayıcıları için KVKK aktarım mekanizmaları. Genel üyelik onayı yurt dışı aktarım mekanizmasının yerine geçmez. Zorunlu olmayan analiz/pazarlama çerezleri otomatik çalıştırılmaz.
- Sipariş kayıtları için hesap silme ve zorunlu saklama politikasının beraber tasarlanması. Şimdiki taslaklar finansal kayıt değildir ve hesapla birlikte silinir.
- Yetki, eşzamanlı satın alma, başarısız/çift bildirim, zaman aşımı, geri ödeme, kargo kaybı, iade ve erişilebilirlik testleri; gerçek sağlayıcı test ortamında uçtan uca doğrulama.

## Resmî kaynaklar (8 Ekim 2026 tarihinde incelendi)

- [iyzico pazaryeri entegrasyonu](https://docs.iyzico.com/urunler/pazaryeri/pazaryeri-entegrasyonu)
- [iyzico bireysel alt üye oluşturma](https://docs.iyzico.com/urunler/pazaryeri/pazaryeri-entegrasyonu/alt-uye-olusturma)
- [TCMB elektronik para kuruluşları](https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb%2Btr/main%2Bmenu/temel%2Bfaaliyetler/odeme%2Bhizmetleri/elektronik%2Bpara%2Bkuruluslari)
- [Ticaret Bakanlığı mesafeli sözleşmeler rehberi](https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme)
- [KVKK yurt dışı aktarım rehberi](https://www.kvkk.gov.tr/Icerik/8143/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi)
- [ETBIS sıkça sorulan sorular](https://etbis.ticaret.gov.tr/tr/SSS?category=/FAQ/etbis-sistem-kullan%C4%B1m%C4%B1-1)
- [Sahibinden S-Param Güvende süreçleri](https://yardim.sahibinden.com/hc/tr/articles/17008717469212-S-Param-G%C3%BCvende-S%C3%BCre%C3%A7leri)

Bu belge açılış planıdır; hukuki uygunluk onayı veya sağlayıcı sözleşmesi değildir.
