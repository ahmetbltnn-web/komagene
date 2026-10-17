# Komagene · Gelir & Gider Paneli

Tek şube için Türkçe ve mobil uyumlu finans takip uygulaması. Yalnızca gelir, gider ve raporlama üzerine kuruludur. React + TypeScript, Express ve Node.js 24'ün SQLite veritabanını kullanır. Ayrı veritabanı sunucusu veya API anahtarı gerekmez.

## Windows'ta ilk kurulum

1. GitHub'da **Code → Download ZIP** ile indirip ZIP'i açın.
2. Bilgisayarınıza **Node.js 24.x** kurun.
3. `package.json` dosyasının bulunduğu klasörde PowerShell açın.
4. Komutları sırayla çalıştırın:

```powershell
npm.cmd ci
npm.cmd run dev
```

İlk komut tamamlandıktan sonra ikinciyi çalıştırın. `npm.cmd`, PowerShell betik politikası nedeniyle `npm.ps1` engellense de çalışır; güvenlik politikasını değiştirmeniz gerekmez. Terminaldeki **Local** adresini tarayıcıya yazın. Kullanım boyunca terminal açık kalır. Durdurmak için **Ctrl+C** kullanın.

İlk ekranda işletme adını, yönetici adını ve en az 10 karakterlik şifreyi belirleyin. **Gerçek kullanım için örnek veri kutusunu boş bırakın.** Varsayılan şifre yoktur. İsterseniz deneme hesabına bu yıl ve önceki yıldan örnek kayıtlar ekleyebilirsiniz; örnek kayıtlar raporlara dahildir ve panelde işaretlenir.

macOS / Linux'ta aynı klasörde `npm ci` ve `npm run dev` çalıştırılır. Bulut checkout yolu `/workspace/komagene` olur; npm önbelleği için `npm ci --cache /tmp/komagene-npm` kullanılabilir.

## Önceki sürümden geçiş — verileri silmeyin

Bu sürüm stok, sipariş ve personel panelinden ayrı bir finans uygulamasıdır. Önceki kaynak sürümü GitHub'da **`arsiv/isletme-paneli-v1`** dalında korunur.

1. Çalışan eski uygulamayı terminalden **Ctrl+C** ile durdurun.
2. Eski uygulama klasörünü, özellikle `data` dizinini saklayın; yeni ZIP'i üzerine açmayın.
3. Yeni ZIP'i **farklı bir klasöre**, örneğin `komagene-finans`, açın.
4. Yeni klasörde yukarıdaki kurulum komutlarını çalıştırın ve finans hesabınızı oluşturun.

Yeni uygulamanın varsayılan dosyası **`data-finans/komagene-finans.sqlite`**'dır. Eski `data/komagene.sqlite` dosyasına dokunulmaz; eski kayıtlar otomatik aktarılmaz. Bu sürümün yedek formatı da ayrıdır; eski sipariş paneli JSON çıktısı içe aktarılamaz. Gerekli başlangıç gelir/giderlerini manuel kaydedebilirsiniz. Uygulamalar aynı portları kullandığından eski uygulama durmadan yenisini başlatmayın.

## Neler yapabilirsiniz?

- **Genel bakış:** Seçili dönemde tahsil edilen gelir, ödenen gider, net fark, kayıt sayısı ve önceki eş dönemle değişim. Günlük/aylık grafik, kategori dağılımı, beklenen gelir ve bekleyen giderler.
- **Gelirler / Giderler:** Tarih veya vade, tutar, kategori, hesap (nakit/banka/kart), açıklama, kişi/firma, belge numarası ve not. Kayıt ekleme, düzenleme ve onaylı silme.
- **Tüm hareketler:** Aylık, yıllık, özel aralık veya tüm zamanlarda arama; tür, kategori, hesap ve durum filtreleri. Tüm filtrelenmiş sonuçları CSV indirme; tablo sayfalaması çıktıyı kısıtlamaz.
- **Raporlar:** Aylık tablo, tüm yılları karşılaştırma, günlük döküm, kategori ve hesap dağılımı. Gelir, gider, net fark, bekleyen tutarlar. Ayrı aylık/yıllık/günlük CSV ve seçili dönem hareket çıktısı. Tarayıcıdan yazdırma veya PDF kaydetme.
- **Kategoriler:** Gelir/gider kategorisi oluşturma, ad ve renk değiştirme. Kayıt içeren kategori silinemez.
- **Ayarlar:** İşletme/yönetici adları, şifre değiştirme, tüm kayıtları JSON yedekleme ve onaylı geri yükleme.

Tarih seçicisinden ayı/yılı seçin, oklarla önceki veya sonraki döneme geçin. Yıl listesi kayıt bulunan tüm yılları kapsar; geçmiş bir yıla kayıt girdiğinizde o yıl listede görünür. 2000–2100 arası tarihler desteklenir. Geçmiş tarihli kayıt girmek mümkündür.

## Toplamlar nasıl hesaplanır?

- **Gelir:** Durumu “Tahsil edildi” olan gelir kayıtları.
- **Gider:** Durumu “Ödendi” olan gider kayıtları.
- **Net fark:** Gerçekleşen gelir eksi gerçekleşen gider. Başlangıç bakiyesi içermeyen dönem hareket farkıdır; gerçek banka/kasa bakiyesi veya resmi muhasebe kârı değildir.
- **Bekleyenler:** Gelir ve gider toplamından ayrı gösterilir. Gerçekleşince kaydı düzenleyip durumunu güncelleyin. Vade geçince sistem otomatik ödeme/tahsilat yapmaz.
- **Tarih:** Raporlar kaydın işlem/vade tarihine göre hesaplanır; oluşturulduğu güne göre değil. Türkiye saat dilimi kullanılır. Gelir/gider tutarları TL, veritabanındaki değerler tam sayı kuruştur; ondalık toplama hatası önlenir.
- **Önceki dönem:** Tam ay için önceki takvim ayı, tam yıl için önceki takvim yılı; özel aralık için hemen öncesindeki aynı gün sayısı. Tüm zamanlar için karşılaştırma gösterilmez.
- **Yıllık karşılaştırma tablosu:** Tüm kayıtlardaki yılları gösterir; üstteki dönem filtresinden bağımsız olduğu açıkça belirtilir. Diğer raporlar seçili döneme aittir.

Grafikler en fazla son 24 ayı gösterir; tablolar ve CSV çıktıları seçili dönemin tamamını kapsar. Özel aralıkla ayın bir kısmı seçildiğinde aylık satır yalnız o aralıktaki kayıtları içerir. Yazdırma seçili dönem özetini, aylık/yıllık tabloları ve kategori/hesap dökümlerini içerir; günlük tam döküm için Günlük CSV'yi kullanın.

## Yedekleme ve geri yükleme

**Ayarlar & yedekleme → Tüm verileri yedekle** ile gelir/giderlerinizi ve kategorilerinizi JSON olarak indirin. Şifre ve oturumlar dosyaya konulmaz. Finansal ve kişisel bilgiler içerdiğinden dosyayı güvenli saklayın. CSV rapor içindir; geri yükleme için JSON kullanılır.

**Yedek dosyası seç** ile JSON'u kontrol ettirin. Uygulama eklenen/atlanan kayıt sayılarını önceden gösterir. **Onayla ve geri yükle** olmadan değişiklik yapılmaz. Geri yükleme mevcut kayıtları silmez. Aynı kimlik ve içerikteki kayıtlar tekrar eklenmez. Aynı kimlikte farklı içerik varsa tüm işlem durur; mevcut veriler değiştirilmez. Kayıt içeren kategorilerin farklı isim/renkle çakışması da durdurulur. Boş yeni hesaptaki kullanılmayan varsayılan kategoriler yedeğe uyarlanabilir. Yeni hesabın işletme adı ve şifresi korunur. En fazla 8 MB, 20.000 kayıt ve 500 kategorilik JSON desteklenir. Örnek veri içeren yedek içe aktarılırsa hesap da örnek veri içeriyor olarak işaretlenir.

Tam sunucu yedeği için uygulamayı durdurup `DATA_DIR` dizininin tamamını başka güvenli bir diske kopyalayın. SQLite WAL kullandığından **çalışan sunucudan yalnız `.sqlite` dosyasını kopyalamayın**. Geri yüklerken mevcut dizinin üzerine yazmak yerine yedek kopyasını ayrı konumda açıp `DATA_DIR` ile kullanın. Kod deposu işletme verisi yedeği değildir.

## Çalıştırma ve dağıtım

Geliştirmede arayüz 5173, API 3001 portundadır. Üretim derlemesi için:

```powershell
npm.cmd run build
npm.cmd start
```

Bu modda Express, arayüzü ve API'yi 3001 portundan sunar. Normal npm komutları macOS/Linux'ta `.cmd` olmadan yazılır. Çalışma dizini proje kökü olmalıdır.

| Değişken        | Varsayılan             | Anlamı                                  |
| --------------- | ---------------------- | --------------------------------------- |
| `PORT`          | `3001`                 | API / üretim sunucusu portu             |
| `HOST`          | `127.0.0.1`            | Dinleme adresi                          |
| `DATA_DIR`      | `data-finans`          | Finans veritabanı dizini                |
| `APP_ORIGIN`    | İsteğin kendi origin'i | HTTPS ters vekil arkasındaki tam origin |
| `COOKIE_SECURE` | `false`                | HTTPS dağıtımında `true`                |

`.env` dosyası otomatik yüklenmez; gerekirse `node --env-file=.env server/index.js` kullanın. Örnekler `.env.example` dosyasındadır. Kalıcı bir sunucuya dağıtım için HTTPS, kalıcı disk, uygun origin/cookie ayarları ve düzenli yedek gerekir. İlk hesabı herkese açmadan önce özel olarak oluşturun. Bu depo kendiliğinden internete yayınlanmaz.

## Doğrulama

```powershell
npm.cmd test
npm.cmd run build
```

API testleri oturum, yetki, veri doğrulama, kuruş hassasiyeti, tarih ve yıl sınırları, bekleyen kayıtların ayrılması, kategori koruması, atomik yedekleme/geri yükleme, şifre değişikliği ve kalıcılığı kontrol eder. Testler geçici dizinlerde çalışır; işletme verilerine dokunmaz.

Tarayıcı testi:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Linux'ta kurulu Chromium için `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` kullanılabilir. Test 4173 portunda ayrı sunucu ve geçici veritabanı açar; masaüstü ve mobil kayıt/rapor/yedek akışını doğrular.

Bu uygulama manuel finans takibidir. Banka/POS/e-fatura entegrasyonu, stok, sipariş veya personel yönetimi içermez; resmi muhasebe/beyanname yerine geçmez. Tek yönetici içindir. Şifre değiştirilebilir; unutulan şifre için kurtarma hizmeti yoktur. Her bulut görevi zaten yalıtılmıştır; mevcut checkout'u kullanın, ayrıca Git worktree oluşturmayın.
