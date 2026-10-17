# Komagene İşletme Paneli

Tek şubeli bir çiğköfte işletmesi için Türkçe, mobil uyumlu web uygulaması. React + TypeScript arayüzü, Express API ve SQLite veritabanı birlikte çalışır. Kayıtlar tarayıcıda değil sunucuda tutulur.

## Başlatma

Node.js **24.x** ve npm gerekir; ayrı veritabanı sunucusu gerekmez.

Bilgisayarınıza ZIP indirerek kullanmak için:

1. GitHub'da **Code → Download ZIP** seçeneğini kullanın ve ZIP'i bir klasöre açın.
2. Node.js 24.x kurun.
3. `package.json` dosyasının bulunduğu klasörde terminal açın ve aşağıdaki komutları sırayla çalıştırın:

```bash
npm ci
npm run dev
```

4. Terminalde gösterilen **Local** adresini tarayıcıda açın. İlk ekranda şube bilgilerinizi ve yönetici şifrenizi belirleyin. Gerçek kayıtlarla başlayacaksanız örnek veri seçeneğini kaldırın.

Bulut çalışma alanındaki mevcut checkout için:

```bash
cd /workspace/komagene
npm ci --cache /tmp/komagene-npm
npm run dev
```

Geliştirmede Vite 5173, API 3001 portunu kullanır. Tarayıcıdan geliştirme sunucusunu açın. İlk ekranda adınızı, şube adını ve en az 10 karakterlik yönetici şifresini belirleyin. Hazır bir kullanıcı veya varsayılan şifre yoktur. İlk kurulum yalnızca bir kez yapılabilir; aynı veritabanıyla sonraki açılışlarda şifre ile giriş yapılır.

“Örnek işletme verileri ekle” seçeneği deneme ürünleri, siparişleri, giderleri ve personeli oluşturur. **Gerçek kullanıma başlarken bu seçeneği kaldırın.** Örnek ve gerçek kayıtlar birlikte oluşturulursa raporlar ikisini de içerir. Panel bu durumu belirtir.

Derlenmiş uygulamayı çalıştırmak için:

```bash
npm run build
npm start
```

Bu modda Express hem API'yi hem arayüzü 3001 portundan sunar. İlk kurulum ekranı yönetici hesabını oluşturduğundan, ilk kurulum tamamlanmadan uygulamayı herkese açık bir adrese açmayın.

## Kullanım

- **Genel bakış:** Günlük ciro, sipariş sayısı, ortalama sepet, aktif siparişler, satış grafiği, satış kanalları ve stok uyarıları.
- **Siparişler:** Şube, paket servis ve gel-al siparişleri. Nakit, kart veya online ödeme yöntemini manuel kaydetme. `Hazırlanıyor → Hazır → Tamamlandı` akışı. Sipariş detayından durum değiştirilebilir.
- **Ürünler & menü:** Ürün, kategori, satış fiyatı, birim maliyet ve minimum stok. Ürünü satışa kapatma; geçmiş satış kayıtları korunur.
- **Stok:** Sipariş açıldığında ürün miktarı stoktan düşer. Hazırlanıyor veya hazır durumundaki sipariş iptal edilince stok bir kez iade edilir. Tamamlanan sipariş iptal edilemez. Stok girişi, fire ve sayım düzeltmeleri açıklamalarıyla kaydedilir.
- **Giderler:** Tarih ve kategoriyle gider kaydı, aylık filtre ve onaylı silme.
- **Personel:** Görev, telefon, kayıtlı aylık maaş ve aktif/pasif personel. Maaş ödemeleri giderlere ayrıca girilir.
- **Raporlar:** Tarih aralığında tamamlanan satışlar, sipariş anındaki ürün maliyeti, giderler, brüt ürün kârı, çok satanlar, günlük özet ve ödeme dağılımı. Excel uyumlu UTF-8 CSV satış çıktısı.
- **Ayarlar:** Şube/yönetici adı değişikliği ve JSON veri çıktısı.

Ciro yalnızca **tamamlanan** siparişleri içerir. Ödeme yöntemi bir kayıttır; uygulama ödeme tahsil etmez. Birim fiyat ve maliyet sipariş anında kopyalanır; ürünün sonraki fiyat değişikliği geçmiş raporları değiştirmez. Para veritabanında tam sayı kuruşla, stok binde bir birim hassasiyetinde tutulur. Sipariş miktarı tam adettir. Stok satılabilir ürün bazındadır; reçete ve hammadde stokları birbirine otomatik bağlı değildir.

Brüt ürün kârı = ciro − satılan ürün maliyeti. Vergi ve işletme giderleri dahil değildir. Malzeme alışlarını gider olarak da kaydettiğinizde maliyetle çift sayım oluşabileceğinden bu metrik net kâr olarak sunulmaz. Tarih ve saatler Türkiye saat dilimindedir. Açık panel verileri 30 saniyede bir günceller.

## Kalıcı veriler ve yedekleme

Varsayılan veritabanı `data/komagene.sqlite` dosyasıdır. `data/` Git'e dahil edilmez. Sunucu yeniden başladığında kayıtlar korunur. Bulutta kalıcı disk kullanın; yalnızca makine görüntüsüne güvenmeyin. Kaynak kodu veya npm bağımlılıkları işletme verilerinin yedeği değildir.

Tam yedek için sunucuyu düzgünce durdurun, `DATA_DIR` dizininin tamamını erişimi kısıtlı başka bir diske kopyalayın ve sonra sunucuyu tekrar başlatın. SQLite WAL kullanıldığı için **çalışan sunucudan yalnızca `.sqlite` dosyasını kopyalamayın**. Geri yüklemek için yine sunucu kapalıyken yedek dizinin bir kopyasını farklı bir konuma açıp `DATA_DIR` ile onu kullanın. Mevcut verileri silmeyin veya üzerine yazmayın.

Ayarlar ekranındaki JSON çıktısı iş kayıtlarını içerir; hesap şifresi ve oturumları içermez. Uygulamada JSON içe aktarma yoktur; bu çıktı tam veritabanı yedeğinin yerine geçmez.

Örnek verilerden ayrı, temiz gerçek kullanım başlatmak için sunucuyu durdurup **yeni ve boş bir dizin** seçin:

```bash
DATA_DIR=/workspace/komagene/data-live npm start
```

İlk kurulumu örnek veri seçeneğini kaldırarak tamamlayın. Eski `data/` dizini korunur. `data-live/` gibi özel veri dizinlerini de Git dışında ve erişimi kısıtlı tutun; tercihen checkout dışındaki kalıcı bir dizin seçin.

## Yapılandırma

Değişkenler süreç ortamından okunur; `.env` dosyası otomatik yüklenmez. Node'un `--env-file` seçeneği veya servis yöneticisi kullanılabilir. Örnekler [.env.example](.env.example) dosyasındadır; şifre koymayın.

| Değişken        | Varsayılan               | Anlamı                                                                                         |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `PORT`          | `3001`                   | Express portu                                                                                  |
| `HOST`          | `127.0.0.1`              | Dinleme adresi                                                                                 |
| `DATA_DIR`      | Çalışma dizininde `data` | Kalıcı SQLite dizini                                                                           |
| `APP_ORIGIN`    | İsteğin kendi origin'i   | HTTPS ters vekil arkasında tarayıcının kullandığı tam origin; örn. `https://panel.example.com` |
| `COOKIE_SECURE` | `false`                  | HTTPS dağıtımında `true` kullanın                                                              |

Geliştirmede Vite API proxy hedefi 3001'dir; `PORT` değiştirirseniz proxy hedefini de uyarlamanız gerekir. Sunucunun çalışma dizini depo kökü olmalıdır.

İnternete dağıtımda HTTPS ters vekil, kalıcı disk, düzenli yedekleme ve doğru `APP_ORIGIN`/`COOKIE_SECURE=true` ayarları gerekir. Sunucu dışarıdan erişilecekse `HOST=0.0.0.0` kullanılır. Bu depodaki kurulum uygulamayı internete yayınlamaz.

## Testler

```bash
npm test
npm run build
```

API testleri geçici veritabanları kullanır: ilk kurulum, oturum, yetkisiz erişim, origin kontrolü, eşzamanlı sipariş, stok aşımı, iptal iadesi, para hassasiyeti, tarih doğrulama ve yeniden açılışta kalıcılık.

Tarayıcı testi gerçek arayüzden ilk kurulum, ürün, sipariş tamamlama, stok girişi, gider, personel, rapor/CSV ve tekrar giriş akışını çalıştırır:

```bash
npx playwright install chromium
npm run test:e2e
```

Makinede Chromium kuruluysa indirme yerine:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Tarayıcı testleri 4173 portunda ayrı sunucu ve geçici veri dizini kullanır; işletme verilerine dokunmaz. `/api/health` sunucu kontrolü içindir. Normal kullanımda harici API veya gizli anahtar gerekmez; npm kurulumu npm kayıt sunucusuna erişir.

## Kapsam

Bu ilk sürüm tek şube ve tek yönetici içindir. Komagene merkez sistemine bağlı değildir. Yemeksepeti/Trendyol/Getir bağlantısı, e-fatura, mali POS, kurye konumu, hammadde reçetesi, vardiya/bordro, çoklu kullanıcı yetkileri ve şifre sıfırlama bu sürümde yoktur. Siparişler manuel girilir. Şifreyi kaybetmeyin; hesap kurtarma akışı yoktur. Veri silerek şifre sıfırlamayın.

Kaynak düzeni: `src/` arayüz, `server/` API/veri modeli, `tests/` API testleri, `e2e/` tarayıcı testi. Her bulut görevi zaten yalıtılmıştır; mevcut checkout'u kullanın, ayrıca Git worktree oluşturmayın.
