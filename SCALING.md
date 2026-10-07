# 10.000 eşzamanlı kullanıcı hedefi

## Kanıt sınırı

Hedef henüz canlı ortamda doğrulanmış değildir. Yerel API testleri, canlı Railway sunucusunun kapasitesi veya telefon/tarayıcı akıcılığı için garanti değildir. Test makinesi i7-13620H ve 32 GB RAM kullanır; ücretsiz canlı ortamın kaynakları farklıdır. Ağ gecikmesi, istemci donanımı ve servis kesintileri nedeniyle mutlak “hiç donmaz” garantisi verilemez.

Yük testi mevcut ürün inceleme, fiyat teklifi, mesaj gönderme ve okundu işaretleme akışlarını kapsar. Uygulamada ödeme veya kargo API'si bulunmaz.

## Uygulanan düzenlemeler

- Fotoğraf kapakları ve dosya erişimi, ilan süreleri, kullanıcı konuşmaları ve okunmamış mesajlar için indeksler.
- En fazla 256 hazırlanmış SQL ifadesinin tekrar kullanımı.
- Süresi dolan ilan bulunmadığında gereksiz UPDATE işleminin yapılmaması.
- Arama için SQLite FTS5 indeksi; ekleme, düzenleme ve silmede aynı veritabanı işlemi içinde güncellenir. Türkçe harfler ve kelime başından arama desteklenir. Yazım hatası genişletmesi sınırlı sözlük adayları üzerinden yapılır. Arama en fazla 300 aday sıralayıp 100 sonuç döndürür; tüm katalogu JavaScript içinde taramaz.
- Mesaj bildirimleri için tek kalp atışı zamanlayıcısı, toplam 20.000 ve hesap başına 4 bağlantı sınırı. Yavaş bağlantıda bildirimler tek yeniden eşitleme sinyaline indirilir; asıl mesajlar veritabanında kalır. Bir dakika boyunca tamponunu boşaltamayan bağlantı kapatılır ve istemci tekrar bağlanabilir.
- Mesaj bağlantısı açıkken 15 saniyede bir yapılan gereksiz okunmamış sayısı sorgusu kaldırıldı. Bağlantı kesildiğinde 30 saniyelik telafi sorgusu ve yeniden bağlanınca eşitleme var.

## Tekrarlanabilir yerel test

Ana ilan akışı 24 kartlık sayfalarla çalışır. Uzun sohbetlerde son 200 mesaj gösterilir; önceki mesajlar cursor ile alınır ve mesaj gönderince son sayfaya dönülür. Canlı bildirimlerde aynı anda bir yenileme çalışır; arka arkaya gelen olaylar bir takip yenilemesinde toplanır. Böylece yavaş yanıtlar sürerken mevcut ekran yenilemesi sürekli iptal edilmez.

```powershell
npm run load:local -- --users=10000 --listings=50000 --seconds=60 --rps=1000 --concurrency=256 --diverse-search=1 --output=scale-results/search-plan-10000.json
```

Komut kendi sunucusunu yalnızca `127.0.0.1` üzerinde açar; ayrı geçici veritabanı ve sentetik hesaplar oluşturur. Canlıya bağlanmaz. Test bitince sadece kendisinin oluşturduğu geçici dizini temizler. 10.000 kullanıcı için 10.000 gerçek, kimliği doğrulanmış SSE bağlantısı açar. HTTP iş yükü ilan inceleme (%40), okunmamış sayısı (%15), konuşma listesi (%15), mesaj okuma (%15), arama (%5), mesaj gönderme (%5), fiyat teklifi (%5) içerir. 100.000 başlangıç mesajı vardır. Kullanıcılar bütün işlemleri aynı anda yapmaz; bu belirtilmiş karma trafik senaryosudur.

Trafik açık hız modeliyle gönderilir. Kuyruk sınırında gönderilemeyen işler `dropped` olarak sayılır ve testi başarısız yapar; sadece işlenebilen trafiği raporlayıp kapasiteyi yüksek göstermez. Gate: HTTP ve SSE hatası yok, düşen iş yok, bütün SSE bağlantıları test sonunda açık, beklenen bildirimler alınmış ve API p95 <500 ms. Bağlantı sayısı, trafik hızı, süre ve veri büyüklüğü raporda birlikte okunmalıdır. Test kısa süreli kapasite ölçümüdür; uzun süreli dayanıklılık sertifikası değildir.

## Mevcut kanıtlar

- `scale-results/baseline-200.json`: indeks düzenlemesi öncesi; 200 bağlantı, 2.000 ilan, 60 işlem/s; p95 4.287 ms, 68 iş düşürüldü. Başarısız.
- `scale-results/indexed-200.json`: aynı senaryo; p95 20 ms, iş kaybı yok. Başarılı.
- `scale-results/indexed-1000.json`: 1.000 bağlantı, 10.000 ilan, 200 işlem/s; p95 82 ms. Başarılı.
- `scale-results/indexed-10000.json`: arama indeksi öncesi 10.000 bağlantı ve 667 işlem/s; p95 1.240 ms, 13.242 iş düşürüldü. Başarısız.
- `scale-results/search-indexed-10000.json`: arama indeksi sonrası aynı senaryo; p95 19 ms, iş kaybı yok. Başarılı.
- `scale-results/diverse-10000.json`: 50.000 ilan ve farklı aramalar, 1.000 işlem/s; sorgu planı sorunu, p95 762 ms. Başarısız.
- `scale-results/search-plan-10000.json`: arama sorgusu FTS indeksinden başlatıldıktan sonraki daha zor senaryonun sonucu. Dosyadaki gate değerini esas al.

Başarısız ölçümler iyileştirme sırasını belgelemek için korunur; üretim kapasitesi kanıtı olarak kullanılamaz.

## Tam hedef için kalan doğrulamalar

Son kapsamlı kod kontrolünde 32 test geçti. 650 mesajlık sohbet testi bütün geçmişe erişimi, son mesajın görünmesini, diğer kullanıcıdan korunmayı ve temizlenen geçmişin tekrar açılmamasını doğrular.

`scale-results/read-check-10000.json` daha gerçekçi okundu trafiğiyle 10.000 açık bağlantı, 50.000 ilan ve 100.000 başlangıç mesajını kullanır. 30 saniyede sunulan 30.000 işin 12.768'i işlendi, 17.232 iş kuyruk sınırında düşürüldü; p95 726 ms. İşlenen mesaj ve teklifler veritabanında eksiksiz bulundu. Bu sonuç **başarısızdır** ve 10.000 aktif kullanıcı kapasitesini doğrulamaz. Önceki küçük senaryoların başarıları bu sonucu değiştirmez. Üretim kapasitesi hedefi açık kalır.

1. Mevcut canlı kaynakların CPU, RAM, disk ve ağ sınırlarını ölçmek; aynı senaryoyu kullanıcı verilerini etkilemeyen bir ortamda aynı kaynaklarla çalıştırmak.
2. Gerçek web ve Android cihazlarda açılış, kaydırma, arama, mesaj teslim gecikmesi, tekrar bağlantı ve bellek kullanımını ölçmek.
3. Daha uzun dayanıklılık testi, toplu açılış dalgası, yoğun dosya yükleme/optimizasyon ve büyüyen konuşma geçmişleri. API anahtarı olmayan fotoğraf denetimi ve SMS servisleri bu testte gerçek sağlayıcılarla çalıştırılmaz.
4. Veritabanı ve dosyaların yedeklenmesi, geri yükleme denemesi ve izleme/uyarı akışı.
5. Ücretsiz kaynaklar yetmiyorsa kaynak bütçesi veya ayrı altyapı sağlamak. Ücretli servis açılmadı; kullanıcının bütçesi yok.

Railway volume bağlı servislerde birden fazla replika desteklemiyor. Mevcut yerel SQLite ve yüklenen dosyalar bir volume üzerinde; bunları ayrı makinelerde bağımsız kopyalar olarak çalıştırmak hesap/mesaj tutarlılığını bozar. Yatay büyüme gerektiğinde ortak veritabanı, dosya depolama ve sunucular arası mesaj yayın kanalı gerekir. Resmî kaynaklar: [Railway volume sınırları](https://docs.railway.com/volumes/reference), [Railway ölçekleme](https://docs.railway.com/deployments/scaling), [SQLite FTS5](https://www.sqlite.org/fts5.html).
