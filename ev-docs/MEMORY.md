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

## Bilinen Sorunlar
- Gerçek form field name'leri henüz dry-run ile keşfedilmedi (formNames tahmini)
