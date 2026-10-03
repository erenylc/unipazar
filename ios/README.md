# Üni Satış iPhone uygulaması

Bu klasör XcodeGen proje tanımı ve iOS kaynak kodunu içerir. macOS üzerinde Xcode ve XcodeGen kurulduktan sonra `xcodegen generate` komutuyla `UniSatis.xcodeproj` oluşturulabilir. Xcode'da Apple Developer takımını seçip gerçek iPhone veya simülatörde dene. App Store Connect'e yükleme macOS/Xcode ve Apple Developer hesabı gerektirir.

Uygulama canlı Üni Satış sitesini WKWebView'da açar; yerel paylaşım, aşağı çekerek yenileme, bağlantı yoksa yeniden deneme ve kamera/mikrofon izin isteme akışları eklenmiştir. Canlı sunucunun erişilebilir olması gerekir. Google ile giriş, kamera, galeri, ses kaydı ve oturumun gerçek iPhone'da ayrıca doğrulanması gerekir. Apple'ın [minimum işlevsellik kuralı](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality) nedeniyle App Store kabulü, web görünümünün tek başına varlığıyla garanti edilemez.

İlk yayın öncesi `com.unisatis.app` kimliğini, kalıcı alan adını, Apple Developer takımını, uygulama simgesini ve hesap silme/engelleme akışlarının gerçek cihazda çalıştığını doğrula.
