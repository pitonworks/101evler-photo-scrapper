# Proje Hafızası

## Proje Bilgisi
101evler.com'dan gelgezgor.com'a otomatik ilan transfer sistemi.

## Teknik Kararlar
- Runtime: Node.js, CommonJS modules
- Web framework: Express 5
- Scraping: Puppeteer (headless Chrome)
- UI: Vanilla HTML/JS, SSE ile progress streaming
- Deployment: WSL2 üzerinde çalışıyor

## Önemli Patternler
- Cloudflare bypass: webdriver gizleme + user agent + 3s bekleme
- 101evler foto: `#st` galeri tab'ından fancybox linklerle çekiliyor
- Watermark kaldırma: `/property_wm/` → `/property_thumb/`
- SSE pattern: `res.write('data: ' + JSON.stringify(data) + '\n\n')`
- Form profilleri: `form-profiles.js` — tip bazlı alan tanımları + deriveFields() akıllı varsayılanlar
- Açıklama parser: `description-parser.js` — eksik detayları açıklamadan çıkar
- Dry-run: formu doldurup submit etmeden keşif + doğrulama

## gelgezgor.com Zorunlu Alanlar (Konut)
Başlık, Fiyat, İl, İlçe (mahalle yok), Oda Sayısı, Bina Yaşı, Kat Sayısı,
Bulunduğu Kat, Asansör (kat≥5→var), Banyo, Balkon (default:1), Isıtma (default:klima, VRF varsa VRF),
Eşyalı, Kullanım Durumu (bina yaşı 0→sıfır, yoksa boş), Site İçi (belirtilmezse hayır),
Aidat (belirtilmezse "-"), Havuz (ortak/özel/belirtilmemiş), Otopark (default: açık),
Krediye Uygun, Kimden (emlak ofisi), Tapu Türü, KDV-Trafo, Takas

## gelgezgor.com Zorunlu Alanlar (Ticari/Dükkan — kat=970)
Konut alanlarının TAMAMI + Depozito, Kiralama Süresi (Kiralamasüresi_), Kira Ödemesi (Kira_odemesi)
Formda olmayan: havuz, krediye_uygun, tapu_turu, kdv_trafo, takas
NOT: kat=970 kiralık formunu gösteriyor (depozito vb. zorunlu)

## gelgezgor.com Zorunlu Alanlar (Arsa/Tarla — kat=101)
Başlık, Fiyat, İl, İlçe, Metrekare, imar_durumu (21 seçenek), tapu_durumu (13 seçenek),
kat_izni, imar_orani, krediye_uygun, kimden, takas
Formda olmayan: tüm konut alanları (oda, banyo, kat, ısıtma vb.)
Ek: ozellikler[] checkboxları (Elektrik, Su, Telefon vb. — şimdilik kullanılmıyor)

## Bina Yaşı Eşleştirme (gelgezgor seçenekleri)
Belirtilmemiş, Proje Aşamasında, 1, 2, 3, 4, "5-10 arası", "11-15 arası", "16-20 arası", "21-25 arası", "26-30 arası", "31 ve üzeri"
DİKKAT: "arası" soneki var, eski "6-10" formatı yanlıştı

## Bilinen Sorunlar
- gelgezgor.com jQuery kullanıyor (Trumbowyg + autoNumeric) → native DOM events yetmez, jQuery.trigger() gerekli
- Photo upload: Native uploadFile() çalışıyor + thumbnail sayma ile completion detection. Bazı durumlarda "DOM.setFileInputFiles timed out" hatası → base64 fallback devreye giriyor. protocolTimeout artırılabilir.
- Submit button: Site JS validation'ı tüm alanlar dolduğunda + onay checkbox işaretlendiğinde butonu aktif eder
- ilçe/mahalle AJAX cascade: bazen ilçe boş kalıyor → submit disabled. İl seçiminden sonra 4s, ilçe seçiminden sonra 3s bekleniyor.
- "Initial thumbnails on page: 50" sorunu: önceki upload'dan kalan thumbnail'ler sayıyı şişiriyor

## Scraping Selektörleri (101evler.com)
- Açıklama: `.div-block-361 .f-s-16` (birincil), fallback: `.f-s-16`, `.w-richtext`, `.col-10`
- Detaylar: `.text-block-141, .ilandetaycomponent` (label+value çiftleri)
- Hızlı detaylar: `.div-block-358` (Emlak Tipi, Oda, Banyo, Alan)
- Galeri: `#st` tab → `a.fancybox-link[data-fancybox]` linkleri
- Konum: `.locationpremiumdivcopy`

## Session Notu (2026-02-15)
### Kuyruk Durumu
- **Done:** 17 ilan (12 başarılı, 5 başarısız)
- **Failed:** 3 (timeout, DNS hatası)
- **Processing:** 1 (ozankoy-villa-303671, fotoğraf yükleme aşamasında)
- **Pending:** 1 (penthouse-269913 tekrar deneme)

### Başarısız İlanlar - Sorun Analizi
1. `penthouse-269913` (eski) → ilçe/mahalle boş kalıyor → submit disabled → sonraki denemede (ilan=21660) başarılı
2. `tarla-291863` → net::ERR_NAME_NOT_RESOLVED (DNS hatası, 101evler erişim sorunu)
3. `villa-296318` → net::ERR_NAME_NOT_RESOLVED (aynı DNS hatası)
4. `hotel-296241` → kat=901 atanmış (hotel tipi desteklenmiyor, fallback daire)
5. `villa-296333` → success=false ama detay yok, muhtemelen form validation

### Çözülmesi Gereken Sorunlar
- `DOM.setFileInputFiles timed out` hatası: protocolTimeout artır veya ilk uploadFile denemesinde timeout kısa tut
- Hotel/otel ilan tipi: CATEGORY_MAP'te yok, kat=901'e düşüyor
- ilçe boş kalma: AJAX bekleme süreleri artırılabilir veya retry mekanizması

## Keşfedilen Form Alan Adları (gelgezgor.com)
- Asansör (büyük A, Türkçe ö), Havuz (büyük H), Otopark (büyük O), Kdv-Trafo (tire ile)
- ilçe: AJAX ile il seçimi sonrası yükleniyor
- fiyat: autoNumeric plugin kullanıyor
- aciklama: Trumbowyg WYSIWYG editör
- onay: custom styled checkbox (JS ile set gerekli)
- buton: disabled=true, tüm required fields dolunca aktif olur
