# Üni Satış geliştirme öncelikleri — 6 Ekim 2026

## İnceleme

[Duck Donuts](https://www.duckdonuts.com/) ana sayfasında belirgin sipariş ve konum düğmeleri, üç adımlı kişiselleştirme anlatımı, Ollie maskotu, üyelik çağrısı ve marka hikâyesi kullanıyor. Üni Satış için bunların karşılığı belirgin ilan verme, kampüs seçimi, alışveriş sürecini anlatan kısa adımlar ve tutarlı öğrenci asistanı olur. Restoran sipariş akışı öğrenci pazarına doğrudan uygulanmamalı.

## Önce güven ve çalışan hizmetler

| Sıra | Geliştirme | Kullanıcıya faydası | Tamamlandığını nasıl ölçeriz? |
|---|---|---|---|
| 1 | Gerçek SMS ve e-posta doğrulaması | İletişim bilgilerine erişim kanıtı | SMS servisinde gerçek teslimat, yanlış/süresi dolmuş kod reddi, doğrulanmamış hesapla işlem engeli |
| 2 | Riskli hesap/ilan inceleme kuyruğu | Şüpheli davranışa hızlı müdahale | Seri ilan, aynı görsel, tekrarlanan şikâyet ve kapora isteği için yöneticiye gerekçeli uyarı |
| 3 | Gerekçeli şikâyet ve durum takibi | Kullanıcı başvurusunun ne olduğunu bilir | Alındı, inceleniyor, sonuçlandı; inceleme ve itiraz kayıtları |
| 4 | Gerçek sohbet botunun etkinleştirilmesi | Öğrenci kendi cümlesiyle soru sorar | Geçerli sağlayıcı anahtarıyla gerçek çok turlu sohbet testi; yardım bilgilerinde olmayan işlem uydurmaz |

Telefon veya e-posta doğrulanmış olması kimlik, öğrencilik veya güvenilirlik garantisi değildir. “Güvenli satıcı” yerine “Telefon doğrulandı” gibi kanıtlanan ifadeler kullanılmalı. Öğrencilik için ayrı üniversite e-postası veya yetkili üniversite doğrulaması gerekir. Kimlik/e-Devlet şifresi sohbet botundan istenmemeli.

## Sonra alışverişi kolaylaştır

| Sıra | Geliştirme | Uygulama önerisi |
|---|---|---|
| 5 | Üç adımlı tanıtım | “İlanı bul → Mesajlaş → Ürünü görerek teslim al”; ilk kullanımda kısa, sonra gizlenebilir |
| 6 | Daha iyi arama/filtre | Fiyat aralığı, ürün durumu, kategori, sıralama; boş sonuçta filtreyi kaldırma önerisi |
| 7 | Kaydedilen aramalar | “Munzur’da 1.000 TL altı kitap” araması için izinli yeni ilan bildirimi |
| 8 | Satıcı profili | Hesap açılış tarihi, doğrulama rozetleri, aktif/tamamlanan ilanlar; yalnızca gerçekten tamamlanan alışverişten değerlendirme |
| 9 | İlan formu rehberi | Fotoğraf sıralama, kapak seçimi, kusur alanı, taslak devamı; ekran başına az alan |
| 10 | Buluşma noktaları | Kampüste bilinen, kalabalık noktalar; kullanıcıya öneri, canlı konumu açık paylaşma yok |

## Büyüme ve kalite

- Üniversite kulüpleri ve kampüs temsilcileriyle kontrollü başlangıç; ilk hedef gerçek ve güncel ilan sayısı.
- Bot maskotu, boş ekranlar, renkler ve yazı dilinde aynı görsel kimlik. Animasyonlar kısa; hareket azaltma tercihine uyumlu.
- İzinli bildirim merkezi: yeni mesaj, teklif, talep sonucu. Pazarlama ile hesap bildirimleri ayrı.
- Mobil ölçüm: ilk görünür içerik, ilan fotoğrafı yükleme, arama yanıtı ve giriş başarısı. Hedefler gerçek cihaz ölçümüne göre belirlenmeli.
- Sunucu hata izleme, kalıcı veritabanı/yükleme diski, otomatik yedek ve geri yükleme denemesi.
- Ödeme/kargo eklemek ayrı ürün çalışmasıdır; ödeme sağlayıcısı, uyuşmazlık, iade ve operasyon hazırlanmadan arayüzde varmış gibi gösterilmemeli.

## Bu çalışmanın durumu

Büyük fotoğraf penceresinde oklar, klavye ve sürükleme geçişi; botta temel selamlaşma; e-posta kodunda deneme sınırı ve Brevo değişiklik akışı; SMS doğrulama altyapısı, tek numara kontrolü ve satıcı doğrulama durumları uygulandı. Gerçek SMS için Netgsm aboneliği/OTP paketi/API ayarları, doğal yapay zekâ sohbeti için sunucu OpenAI anahtarı gerekiyor. Bu belgede önerilen diğer özellikler henüz uygulanmış sayılmaz.
