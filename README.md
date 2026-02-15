# 101evler → gelgezgor.com Listing Transfer

101evler.com'dan ilan bilgilerini (fotoğraf + tüm detaylar) otomatik olarak çekip gelgezgor.com'a giren web uygulaması.

## Özellikler

- **Otomatik scraping** — 101evler.com ilanlarından başlık, fiyat, detaylar ve fotoğrafları çeker
- **Otomatik form doldurma** — gelgezgor.com ilan formunu profil bazlı doldurur
- **5 emlak tipi desteği** — Konut, Villa, Arsa/Tarla, Ticari (Dükkan/İşyeri), Penthouse
- **Akıllı varsayılanlar** — Asansör, ısıtma, kullanım durumu, havuz, otopark gibi alanları otomatik tespit eder
- **Kuyruk sistemi** — Birden fazla ilanı sıraya alıp toplu işleme
- **Dry-run modu** — Formu submit etmeden test etme
- **Web arayüzü** — SSE ile gerçek zamanlı ilerleme takibi

## Kurulum

```bash
npm install
```

## Kullanım

### Web Arayüzü

```bash
npm start
# http://localhost:3000 adresinden erişin
```

### CLI (Sadece Fotoğraf)

```bash
node scrape.js <101evler-url> <output-dir>
```

## Mimari

```
server.js            → Express sunucu + API endpoints
scrape.js            → 101evler scraper (metadata + fotoğraf)
post.js              → gelgezgor.com otomasyon (giriş + form doldurma + submit)
form-profiles.js     → Emlak tipi bazlı form alan tanımları
description-parser.js→ Açıklamalardan eksik bilgi çıkarma
browser.js           → Puppeteer yardımcıları (Cloudflare bypass)
queue-store.js       → Kuyruk veri yönetimi (JSON dosya)
queue-worker.js      → Kuyruk işleme motoru
public/              → Web arayüzü (HTML/JS)
ev-docs/             → Proje dokümantasyonu
ev-config/           → Teknik yapılandırma
```

## Desteklenen İlan Tipleri

| Tip | Kategori Kodu | Kaynak Keyword'ler |
|-----|---------------|-------------------|
| Daire | 901 (satılık), 912 (kiralık) | satilik-daire, kiralik-daire |
| Villa | 904, 915 | satilik-villa, kiralik-villa |
| Penthouse | 18260, 19100 | satilik-penthouse, kiralik-penthouse |
| Müstakil Ev | 903, 914 | satilik-mustakil-ev, kiralik-mustakil-ev |
| Studio | 902 | satilik-studio |
| İkiz Villa | 19633 | satilik-ikiz-villa |
| Arsa/Tarla | 101 | satilik-arsa, satilik-tarla |
| Dükkan/İşyeri | 970 | satilik-dukkan, kiralik-dukkan, satilik-isyeri, kiralik-isyeri |

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/transfer` | Tek ilan transferi (scrape + post) |
| POST | `/scrape` | Sadece fotoğraf çekme |
| GET/POST | `/queue` | Kuyruk yönetimi |
| POST | `/queue/start` | Kuyruk işlemeyi başlat |
| POST | `/queue/stop` | Kuyruk işlemeyi durdur |
| GET | `/queue/progress` | SSE ile ilerleme takibi |
| GET | `/browse` | Dosya sistemi gezgini |

## Teknoloji

- **Runtime:** Node.js 18+ (CommonJS)
- **Web:** Express 5
- **Scraping:** Puppeteer (headless Chrome)
- **UI:** Vanilla HTML/JS + SSE
